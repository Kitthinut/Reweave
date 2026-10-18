import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { DemoPaymentMethod, FashionPost, MarketplaceListing } from "./communityTypes";

export type CommunityFriend = {
  uid: string;
  name: string;
  handle: string;
  avatar?: string;
  chatId: string;
  waterHelpBy?: Record<string, string>;
};

export type CommunityFriendRequest = {
  senderId: string;
  recipientId: string;
  sender: Pick<CommunityFriend, "name" | "handle" | "avatar">;
  status: "pending";
  createdAt: number;
};

export type CommunityMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  text: string;
  createdAt: number;
  readBy: string[];
  sharedPost?: { id: string; ownerId: string; ownerName: string; look: string; image: string };
};

const friendshipCollection = collection(db, "communityFriendships");
const chatsCollection = collection(db, "communityChats");
const friendRequestsCollection = collection(db, "communityFriendRequests");
const makeChatId = (firstUid: string, secondUid: string) => [firstUid, secondUid].sort().join("__");
const makeFriendRequestId = (senderUid: string, recipientUid: string) => `${senderUid}__${recipientUid}`;

export async function loadUser(uid: string): Promise<Record<string, any> | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as Record<string, any>) : null;
}

export function saveUser(uid: string, data: Record<string, unknown>) {
  return setDoc(doc(db, "users", uid), data, { merge: true });
}

/** Shrinks an image data-URL so it stays tiny (Firestore documents max out at 1 MiB). */
export function shrinkImage(dataUrl: string, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ---- garments: users/{uid}/garments/{id} (one small document per piece) ----

const garmentsOf = (uid: string) => collection(db, "users", uid, "garments");

export async function loadGarments<T extends { id: string | number }>(uid: string): Promise<T[]> {
  const snap = await getDocs(garmentsOf(uid));
  return snap.docs
    .map((d) => ({ ...(d.data() as object), id: d.id }) as unknown as T & { createdAt?: number })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** A photo over ~300 KB is shrunk first so the document always fits under Firestore's 1 MiB limit. */
async function safeImage(image: unknown): Promise<unknown> {
  if (typeof image === "string" && image.startsWith("data:") && image.length > 300_000) return shrinkImage(image, 480);
  return image;
}

export async function saveGarment(uid: string, garment: { id: string | number; image?: unknown; [key: string]: unknown }) {
  const { id, ...rest } = garment;
  const data = { ...rest, ...(rest.image !== undefined ? { image: await safeImage(rest.image) } : {}) };
  // merge: true works for both a brand-new piece and a partial edit
  await setDoc(doc(garmentsOf(uid), String(id)), { createdAt: Date.now(), ...data }, { merge: true });
}

export const removeGarment = (uid: string, id: string | number) => deleteDoc(doc(garmentsOf(uid), String(id)));

export async function setGarmentsCloset(uid: string, ids: (string | number)[], closet: string) {
  for (let i = 0; i < ids.length; i += 400) { // a batch holds up to 500 writes
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.set(doc(garmentsOf(uid), String(id)), { closet }, { merge: true }));
    await batch.commit();
  }
}

const communityPosts = collection(db, "communityPosts");
const privatePostsOf = (uid: string) => collection(db, "users", uid, "privateCommunityPosts");

export function createCommunityId() {
  return doc(communityPosts).id;
}

export async function getCommunityRelationship(uid: string, otherUid: string) {
  const followingRef = doc(db, "users", uid, "following", otherUid);
  const outgoingRequestRef = doc(friendRequestsCollection, makeFriendRequestId(uid, otherUid));
  const incomingRequestRef = doc(friendRequestsCollection, makeFriendRequestId(otherUid, uid));
  const [following, outgoingRequest, incomingRequest] = await Promise.all([
    getDoc(followingRef),
    getDoc(outgoingRequestRef),
    getDoc(incomingRequestRef),
  ]);
  const outgoingStatus = outgoingRequest.exists() ? outgoingRequest.data().status : undefined;
  const incomingStatus = incomingRequest.exists() ? incomingRequest.data().status : undefined;
  return {
    following: following.exists(),
    friendStatus: outgoingStatus === "accepted" || incomingStatus === "accepted"
      ? "friends" as const
      : incomingStatus === "pending" ? "pending_received" as const
      : outgoingStatus === "pending" ? "pending_sent" as const
      : "none" as const,
  };
}

export async function setCommunityFollow(uid: string, otherUid: string, following: boolean) {
  const followingRef = doc(db, "users", uid, "following", otherUid);
  if (following) {
    await deleteDoc(followingRef);
    return;
  }
  await setDoc(followingRef, { userId: otherUid, createdAt: Date.now() });
}

export async function sendCommunityFriendRequest(uid: string, otherUid: string, sender: Pick<CommunityFriend, "name" | "handle" | "avatar">) {
  await setDoc(doc(friendRequestsCollection, makeFriendRequestId(uid, otherUid)), {
    senderId: uid,
    recipientId: otherUid,
    sender,
    status: "pending",
    createdAt: Date.now(),
  });
}

export async function acceptCommunityFriendRequest(uid: string, otherUid: string, recipient: Pick<CommunityFriend, "name" | "handle" | "avatar">) {
  const requestRef = doc(friendRequestsCollection, makeFriendRequestId(otherUid, uid));
  const chatId = makeChatId(uid, otherUid);
  const friendshipRef = doc(friendshipCollection, chatId);
  const chatRef = doc(chatsCollection, chatId);
  await runTransaction(db, async (transaction) => {
    const request = await transaction.get(requestRef);
    if (!request.exists() || request.data().status !== "pending") {
      throw new Error("This friend request is no longer pending.");
    }
    const sender = request.data().sender ?? { name: "Member", handle: "" };
    const members = [
      { uid: otherUid, ...sender },
      { uid, ...recipient },
    ];
    transaction.update(requestRef, { status: "accepted", updatedAt: Date.now() });
    transaction.set(friendshipRef, { chatId, memberIds: [uid, otherUid], members, waterHelpBy: {}, createdAt: Date.now() });
    transaction.set(chatRef, { chatId, memberIds: [uid, otherUid], createdAt: Date.now() });
  });
}

export function subscribeCommunityFriends(uid: string, onFriends: (friends: CommunityFriend[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(friendshipCollection, where("memberIds", "array-contains", uid)), (snapshot) => {
    const friends = snapshot.docs.map((item) => {
      const data = item.data();
      const member = (data.members ?? []).find((candidate: CommunityFriend) => candidate.uid !== uid);
      return {
        uid: member?.uid ?? "",
        name: member?.name ?? "Member",
        handle: member?.handle ?? "",
        avatar: member?.avatar,
        chatId: item.id,
        waterHelpBy: data.waterHelpBy ?? {},
      };
    }).filter((friend) => friend.uid);
    onFriends(friends);
  }, onError);
}

export function subscribeIncomingCommunityFriendRequests(
  uid: string,
  onRequests: (requests: CommunityFriendRequest[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(query(friendRequestsCollection, where("recipientId", "==", uid)), (snapshot) => {
    onRequests(snapshot.docs
      .map((item) => item.data() as CommunityFriendRequest)
      .filter((request) => request.status === "pending")
      .sort((a, b) => b.createdAt - a.createdAt));
  }, onError);
}

export async function helpCommunityFriend(chatId: string, uid: string, date: string) {
  const friendshipRef = doc(friendshipCollection, chatId);
  return runTransaction(db, async (transaction) => {
    const friendship = await transaction.get(friendshipRef);
    if (!friendship.exists() || !friendship.data().memberIds?.includes(uid)) {
      throw new Error("You are not a member of this friendship.");
    }
    if (friendship.data().waterHelpBy?.[uid] === date) return false;
    transaction.update(friendshipRef, { [`waterHelpBy.${uid}`]: date });
    return true;
  });
}

export function subscribeCommunityMessages(chatId: string, onMessages: (messages: CommunityMessage[]) => void, onError: (error: Error) => void) {
  const messages = collection(db, "communityChats", chatId, "messages");
  return onSnapshot(query(messages, orderBy("createdAt", "asc")), (snapshot) => {
    onMessages(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as CommunityMessage));
  }, onError);
}

export async function sendCommunityMessage(chatId: string, message: Omit<CommunityMessage, "id">) {
  const messageRef = doc(collection(db, "communityChats", chatId, "messages"));
  await setDoc(messageRef, message);
}

export async function markCommunityMessagesRead(chatId: string, uid: string, messages: CommunityMessage[]) {
  const unread = messages.filter((message) => message.senderId !== uid && !message.readBy?.includes(uid));
  for (let i = 0; i < unread.length; i += 400) {
    const batch = writeBatch(db);
    unread.slice(i, i + 400).forEach((message) => {
      batch.update(doc(db, "communityChats", chatId, "messages", message.id), { readBy: arrayUnion(uid) });
    });
    await batch.commit();
  }
}

export function subscribeCommunityPosts(onPosts: (posts: FashionPost[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(communityPosts, where("privacy", "==", "public")), (snapshot) => {
    onPosts(snapshot.docs
      .map((post) => ({ ...post.data(), id: post.id }) as FashionPost)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }, onError);
}

export async function saveCommunityPost(uid: string, post: FashionPost) {
  if (post.ownerId && post.ownerId !== uid) throw new Error("Cannot save a community post owned by another user.");

  let image = post.image;
  if (image.startsWith("data:") && image.length > 350_000) {
    image = await shrinkImage(image, 512);
    if (image.length > 750_000) image = await shrinkImage(image, 320);
  }

  const postData = {
    ...post,
    ownerId: uid,
    image,
    createdAt: post.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    ...(post.privacy === "public" ? {} : { likedBy: [], likes: 0, comments: [] }),
  };
  if (post.privacy === "public") {
    await setDoc(doc(communityPosts, post.id), postData);
    return;
  }

  const publicPostRef = doc(communityPosts, post.id);
  const privatePostRef = doc(privatePostsOf(uid), post.id);
  await runTransaction(db, async (transaction) => {
    const publicPost = await transaction.get(publicPostRef);
    if (publicPost.exists() && publicPost.data().ownerId !== uid) {
      throw new Error("Cannot change another user's community post.");
    }
    if (publicPost.exists()) transaction.delete(publicPostRef);
    transaction.set(privatePostRef, postData);
  });
}

export async function toggleCommunityLike(postId: string, uid: string, liked: boolean) {
  await updateDoc(doc(communityPosts, postId), { likedBy: liked ? arrayRemove(uid) : arrayUnion(uid) });
}

export async function addCommunityComment(postId: string, comment: { id: string; ownerId: string; name: string; text: string; createdAt: number }) {
  await updateDoc(doc(communityPosts, postId), { comments: arrayUnion(comment) });
}

const marketplaceListings = collection(db, "marketplaceListings");
const marketplaceOrders = collection(db, "marketplaceOrders");

export function subscribeMarketplaceListings(onListings: (listings: MarketplaceListing[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(marketplaceListings, orderBy("createdAt", "desc")), (snapshot) => {
    onListings(snapshot.docs.map((listing) => ({ ...listing.data(), id: listing.id }) as MarketplaceListing));
  }, onError);
}

export async function createMarketplaceListing(listing: MarketplaceListing) {
  let image = listing.image;
  if (image.startsWith("data:") && image.length > 350_000) {
    image = await shrinkImage(image, 512);
    if (image.length > 750_000) image = await shrinkImage(image, 320);
  }
  await setDoc(doc(marketplaceListings, listing.id), { ...listing, image });
}

export async function deleteMarketplaceListing(listingId: string, sellerId: string) {
  const listingRef = doc(marketplaceListings, listingId);
  const listing = await getDoc(listingRef);
  if (!listing.exists()) return;
  if (listing.data().sellerId !== sellerId) throw new Error("Cannot remove another user's listing.");
  if (listing.data().sold) throw new Error("A sold listing cannot be removed.");
  await deleteDoc(listingRef);
}

export async function completeMockPurchase(listing: MarketplaceListing, buyerId: string, buyerName: string, paymentMethod: DemoPaymentMethod) {
  const listingRef = doc(marketplaceListings, listing.id);
  const orderRef = doc(marketplaceOrders);
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(listingRef);
    if (!current.exists()) throw new Error("This listing is no longer available.");
    const data = current.data() as MarketplaceListing;
    if (data.sold) throw new Error("This listing has already been sold.");
    if (data.sellerId === buyerId) throw new Error("You cannot buy your own listing.");

    transaction.update(listingRef, { sold: true, soldAt: Date.now() });
    transaction.set(orderRef, {
      listingId: data.id,
      listingName: data.name,
      sellerId: data.sellerId,
      sellerName: data.seller,
      buyerId,
      buyerName,
      amount: data.price,
      paymentMethod,
      status: "mock-checkout-complete",
      createdAt: Date.now(),
    });
  });
}