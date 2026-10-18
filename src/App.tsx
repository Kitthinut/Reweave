import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthGate";
import { acceptCommunityFriendRequest, addCommunityComment, createCommunityId, getCommunityRelationship, helpCommunityFriend, loadUser, markCommunityMessagesRead, saveUser, sendCommunityFriendRequest, sendCommunityMessage, setCommunityFollow, shrinkImage, loadGarments, saveGarment, removeGarment, setGarmentsCloset, saveCommunityPost, subscribeCommunityFriends, subscribeCommunityMessages, subscribeCommunityPosts, toggleCommunityLike, subscribeMarketplaceListings, createMarketplaceListing, completeMockPurchase, deleteMarketplaceListing, type CommunityFriend, type CommunityMessage } from "./userData";
import type { CommunityComment, CommunityGarment, DemoPaymentMethod, FashionPost, MarketplaceListing } from "./communityTypes";
import HelpTour from "./Helptour";
import { parseComposition, naturalFiberShare } from "./composition";
import { prepareGarmentPhoto, readTagText } from "./ImageTools";
import { colorCss } from "./colors";
import { checkPlant, freshPlant, localDate, plantStage, STAGE_LABELS, STAGE_RANGES, DAYS_TO_FULL, type PlantData } from "./plant";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  ChevronDown,
  CircleUserRound,
  CloudSun,
  Droplets,
  FolderPlus,
  ExternalLink,
  Eye,
  EyeOff,
  Gift,
  Globe2,
  Heart,
  ImagePlus,
  Leaf,
  Lock,
  LoaderCircle,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Plus,
  Pencil,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Store,
  Sun,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

type MainTab = "plant" | "closet" | "community" | "profile";
type ClosetTab = "wardrobe" | "match";
type CommunityTab = "feed" | "shop";
type Lang = "en" | "th";

const copy = {
  en: {
    plant: "Plant", closet: "Closet", community: "Community", profile: "Profile",
    language: "ไทย", morning: "Good morning", wardrobe: "Your wardrobe", wardrobeSub: "Wear what you already love",
    circle: "The Reweave circle", circleSub: "Style worth sharing", space: "Your space", spaceSub: "Profile & impact",
    myCloset: "My closet", match: "Match!", looks: "Looks", shop: "Secondhand shop",
    editProfile: "Edit profile", pointShop: "Point shop", friends: "Friends & chat", privacy: "Privacy",
    shareLook: "Share a look", whatRewear: "What did you rewear today?", addPiece: "Add piece",
    search: "Find a piece", communitySearch: "Search clothes, fashion, or style tags", shopSearch: "Search clothing, style, or tags", details: "Scroll to browse · Tap for details", coupons: "Coupons and repair rewards",
  },
  th: {
    plant: "ต้นฝ้าย", closet: "ตู้เสื้อผ้า", community: "ชุมชน", profile: "โปรไฟล์",
    language: "EN", morning: "สวัสดีตอนเช้า", wardrobe: "ตู้เสื้อผ้าของคุณ", wardrobeSub: "ใส่เสื้อผ้าที่คุณรักให้คุ้มค่า",
    circle: "ชุมชน Reweave", circleSub: "แบ่งปันสไตล์ที่มีความหมาย", space: "พื้นที่ของคุณ", spaceSub: "โปรไฟล์และผลลัพธ์",
    myCloset: "ตู้ของฉัน", match: "จับคู่!", looks: "แฟชั่น", shop: "ร้านเสื้อผ้ามือสอง",
    editProfile: "แก้ไขโปรไฟล์", pointShop: "ร้านค้าคะแนน", friends: "เพื่อนและแชต", privacy: "ความเป็นส่วนตัว",
    shareLook: "แชร์ลุค", whatRewear: "วันนี้คุณใส่ชุดไหนซ้ำ?", addPiece: "เพิ่มเสื้อผ้า",
    search: "ค้นหาเสื้อผ้า", communitySearch: "ค้นหาเสื้อผ้า แฟชั่น หรือแท็กสไตล์", shopSearch: "ค้นหาเสื้อผ้า สไตล์ หรือแท็ก", details: "เลื่อนดู · แตะเพื่อดูรายละเอียด", coupons: "คูปองและรางวัลซ่อมเสื้อผ้า",
  },
} as const;

type Translation = { [Key in keyof typeof copy.en]: string };
const LanguageContext = createContext<{ lang: Lang; t: Translation }>({ lang: "en", t: copy.en });
const useLanguage = () => useContext(LanguageContext);

const thaiGarmentNames: Record<string, string> = {
  "Cloud linen shirt": "เสื้อลินินสีงาช้าง",
  "Washed straight jeans": "ยีนส์ทรงตรงสีฟอก",
  "Moss overshirt": "โอเวอร์เชิ้ตสีเขียวมอส",
  "Soft column dress": "เดรสคอตตอนทรงตรง",
};

const FASHION_STYLES = ["Minimal", "Streetwear", "Classic", "Casual", "Vintage", "Sporty", "Bohemian", "Workwear", "Formal", "Y2K", "Preppy", "Outdoor"];
const FASHION_TAGS = ["Everyday", "Layering", "Monochrome", "Natural fibers", "Upcycled", "Repaired", "Statement", "Relaxed fit", "Tailored", "Denim", "Knitwear", "Outerwear"];
const CLOTHING_TYPES = ["Top", "Shirt", "T-shirt", "Blouse", "Sweater", "Hoodie", "Jacket", "Coat", "Dress", "Skirt", "Pants", "Jeans", "Shorts", "Shoes", "Bag", "Other"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "One size", "Other"];

function isFirestorePermissionDenied(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "permission-denied";
}

function useCommunityInbox(userId: string) {
  const [friends, setFriends] = useState<CommunityFriend[]>([]);
  const [unreadByChat, setUnreadByChat] = useState<Record<string, CommunityMessage[]>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let messageStops: (() => void)[] = [];
    const stopFriends = subscribeCommunityFriends(userId, (items) => {
      messageStops.forEach((stop) => stop());
      messageStops = [];
      setFriends(items);
      setUnreadByChat({});
      messageStops = items.map((friend) => subscribeCommunityMessages(friend.chatId, (messages) => {
        setUnreadByChat((current) => ({
          ...current,
          [friend.chatId]: messages.filter((message) => message.senderId !== userId && !message.readBy?.includes(userId)),
        }));
      }, (messageError) => {
        console.error("Could not load unread community messages", messageError);
        setError("Could not load messages. Check your Firestore chat rules.");
      }));
      setError("");
    }, (friendError) => {
      console.error("Could not load community friends", friendError);
      setError("Could not load friends. Check your Firestore friendship rules.");
    });
    return () => {
      stopFriends();
      messageStops.forEach((stop) => stop());
    };
  }, [userId]);
  return { friends, unreadByChat, error };
}

function useFriendActivityNotifications(friends: CommunityFriend[], preferences: NotificationPreferences) {
  const [activities, setActivities] = useState<FriendActivityNotification[]>([]);
  const [error, setError] = useState("");
  const friendIds = friends.map((friend) => friend.uid).sort().join("|");
  const friendNameKey = friends.map((friend) => `${friend.uid}:${friend.name}`).sort().join("|");
  const friendNames = new Map(friends.map((friend) => [friend.uid, friend.name]));

  useEffect(() => {
    if (!friendIds || (!preferences.friendPosts && !preferences.friendListings)) {
      setActivities([]);
      setError("");
      return;
    }
    const wantedFriends = new Set(friendIds.split("|"));
    let posts: FriendActivityNotification[] = [];
    let listings: FriendActivityNotification[] = [];
    const publish = () => setActivities([...posts, ...listings].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30));
    const stops: (() => void)[] = [];

    if (preferences.friendPosts) {
      stops.push(subscribeCommunityPosts((items) => {
        posts = items
          .filter((post) => post.ownerId && wantedFriends.has(post.ownerId))
          .map((post) => ({
            id: `post:${post.id}`,
            type: "post",
            friendName: friendNames.get(post.ownerId ?? "") ?? post.name,
            title: post.look,
            image: post.image,
            createdAt: post.createdAt ?? 0,
          }));
        publish();
        setError("");
      }, (loadError) => {
        console.error("Could not load friend post notifications", loadError);
        setError("Could not load friend post notifications. Check your Firestore community post rules.");
      }));
    }
    if (preferences.friendListings) {
      stops.push(subscribeMarketplaceListings((items) => {
        listings = items
          .filter((listing) => !listing.sold && wantedFriends.has(listing.sellerId))
          .map((listing) => ({
            id: `listing:${listing.id}`,
            type: "listing",
            friendName: friendNames.get(listing.sellerId) ?? listing.seller,
            title: listing.name,
            image: listing.image,
            createdAt: listing.createdAt,
          }));
        publish();
        setError("");
      }, (loadError) => {
        console.error("Could not load friend listing notifications", loadError);
        setError("Could not load friend listing notifications. Check your Firestore marketplace rules.");
      }));
    }
    return () => stops.forEach((stop) => stop());
  }, [friendIds, friendNameKey, preferences.friendPosts, preferences.friendListings]);

  return { activities, error };
}

function useMarketplaceListings(lang: Lang) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeMarketplaceListings((items) => {
    setListings(items
      .map((item) => ({ ...item, tags: Array.isArray(item.tags) ? item.tags : [] }))
      .filter((item) => !item.sold && Boolean(item.sellerId && item.name && item.image && item.style && item.type)));
    setLoading(false);
    setError("");
  }, (loadError) => {
    console.error("Could not load secondhand listings", loadError);
    setLoading(false);
    setError(isFirestorePermissionDenied(loadError)
      ? lang === "th"
        ? "กฎ Firestore ปฏิเสธการเข้าถึง: อนุญาตให้ผู้ใช้ที่เข้าสู่ระบบอ่าน marketplaceListings"
        : "Firestore rules denied access. Allow signed-in users to read marketplaceListings."
      : lang === "th" ? "โหลดรายการเสื้อผ้าไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not load clothing listings. Please try again.");
  }), [lang]);
  return { listings, loading, error };
}

function TagDropdown({ label, emptyLabel, options, selected, onChange }: { label: string; emptyLabel: string; options: string[]; selected: string[]; onChange: (tags: string[]) => void }) {
  return (
    <details className="tag-dropdown">
      <summary><Tag size={15} /><span>{label}</span><small>{selected.length ? selected.join(", ") : emptyLabel}</small><ChevronDown size={15} /></summary>
      <div className="tag-dropdown-options">
        {options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter((tag) => tag !== option) : [...selected, option])} />{option}</label>)}
      </div>
    </details>
  );
}

function garmentName(garment: Pick<Garment, "name">, lang: Lang) {
  return lang === "th" ? thaiGarmentNames[garment.name] || garment.name : garment.name;
}

type Garment = {
  id: string | number;
  name: string;
  type: string;
  color: string;
  material: string;
  components?: string;
  style?: string;
  occasion?: string;
  owner?: string;
  closet: string;
  image: string;
  notes?: string;
  wearCount?: number;
};

type Profile = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  age: number;
  location: string;
  bio: string;
  avatar: string;
  verified: boolean;
  points: number;
  buyingCredits: number;
  theme: string;
  privacy: string;
};

type BoardThread = {
  id: string;
  title: string;
  topic: string;
  body: string;
  author: string;
  comments: string[];
};

type Plant = PlantData;

type DemoState = {
  wateredOn: string | null;
  points: number;
  dark: boolean;
  garments: Garment[];
  profile: Profile;
  plant: Plant;
  closets: string[];
  postBonusOn: string | null;
};

type NotificationPreferences = {
  dailyWater: boolean;
  friendPosts: boolean;
  friendListings: boolean;
};

type FriendActivityNotification = {
  id: string;
  type: "post" | "listing";
  friendName: string;
  title: string;
  image: string;
  createdAt: number;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyWater: true,
  friendPosts: true,
  friendListings: true,
};

const TODAY = localDate();
const STORAGE_KEY = "reweave-local-v2";
const DEFAULT_CLOSET = "Everyday";
/** A garment whose closet no longer exists is shown in the default closet. */
const closetOf = (garment: Garment, closets: string[]) => (closets.includes(garment.closet) ? garment.closet : DEFAULT_CLOSET);

const photos = {
  linen: "https://images.unsplash.com/photo-1580682312385-e94d8de1cf3c?auto=format&fit=crop&w=700&q=85",
};

/** ids of the old built-in sample clothes (removed). Used only to clean them out of older saved data. */
const OLD_DEMO_GARMENT_IDS = new Set(["1", "2", "3", "4"]);

const initialState: DemoState = {
  wateredOn: null,
  points: 0,
  dark: false,
  garments: [],
  profile: {
    id: "",
    email: "",
    displayName: "Maya Chen",
    username: "@maya.reweaves",
    age: 24,
    location: "Singapore",
    bio: "Rewearing more, wasting less.",
    avatar: "",
    verified: false,
    points: 0,
    buyingCredits: 0,
    theme: "light",
    privacy: "private",
  },
  plant: freshPlant(TODAY),
  closets: [DEFAULT_CLOSET],
  postBonusOn: null,
};

function loadState(uid: string): DemoState {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${uid}`);
    return saved ? { ...initialState, ...JSON.parse(saved) } : initialState;
  } catch {
    return initialState;
  }
}

const stageSteps = STAGE_LABELS.map((label, i) => ({ label, range: STAGE_RANGES[i] }));
// Day on which each stage begins: Young 0, Medium 11, Flower 21, Cotton 31, Full 41
const STAGE_STARTS = [0, 11, 21, 31, 41];
/** 0–1 fill of the journey line. Reaches each dot exactly on the day its stage begins. */
function journeyProgress(caredDays: number): number {
  const stage = plantStage(caredDays);
  if (stage >= 5) return 1;
  const from = STAGE_STARTS[stage - 1], to = STAGE_STARTS[stage];
  const within = Math.min(1, Math.max(0, (caredDays - from) / (to - from)));
  return (stage - 1 + within) / 4;
}

function PlantArtwork({ stage, alive }: { stage: number; alive: boolean }) {
  return (
    <div className="plant-art" aria-label={`Replaceable artwork placeholder for cotton stage ${stage}`}>
      <div className="sun-orbit" />
      <div className="leaf leaf-left" />
      <div className="leaf leaf-right" />
      <div className="stem" />
      <div className="cotton cotton-one" />
      <div className="cotton cotton-two" />
      <div className="cotton cotton-three" />
      <div className="soil" />
      <span className="art-note">{alive ? `Your stage ${stage} illustration` : "Your withered-plant illustration"}</span>
    </div>
  );
}

function Header({
  title,
  eyebrow,
  onTheme,
  onChat,
  onNotifications,
  onLanguage,
  notificationCount,
  dark,
}: {
  title: string;
  eyebrow: string;
  onTheme: () => void;
  onChat: () => void;
  onNotifications: () => void;
  onLanguage: () => void;
  notificationCount: number;
  dark: boolean;
}) {
  const { t } = useLanguage();
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <div className="top-actions" data-tour="top-actions">
        <button className="language-button" onClick={onLanguage} aria-label="Change language">
          <Globe2 size={17} /> {t.language}
        </button>
        <button className="icon-button" onClick={onTheme} aria-label="Toggle color theme">
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button className="icon-button" onClick={onChat} aria-label="Open messages">
          <MessageCircle size={18} />
          <span />
        </button>
        <button className="avatar-button" onClick={onNotifications} aria-label={`Open notifications${notificationCount ? `, ${notificationCount} items` : ""}`}>
          <Bell size={18} />
          {notificationCount > 0 && <span className="notification-count">{notificationCount > 9 ? "9+" : notificationCount}</span>}
        </button>
      </div>
    </header>
  );
}

function PlantView({
  state,
  onWater,
  onReplant,
}: {
  state: DemoState;
  onWater: () => Promise<void>;
  onReplant: () => void;
}) {
  const { lang } = useLanguage();
  const watered = state.wateredOn === TODAY;
  const { caredDays, alive } = state.plant;
  const stage = plantStage(caredDays);
  const daysLeft = Math.max(0, DAYS_TO_FULL - caredDays);
  const [factOpen, setFactOpen] = useState(false);

  return (
    <div className="page plant-page">
      <section className="hero-grid">
        <div className="plant-copy">
          <span className="status-pill">
            <CloudSun size={15} /> {!alive ? (lang === "th" ? "ต้นฝ้ายเฉาแล้ว" : "Your cotton withered") : lang === "th" ? `วันที่ ${Math.max(1, caredDays)} · ระยะ ${stage}` : `Day ${Math.max(1, caredDays)} · ${STAGE_LABELS[stage - 1]}`}
          </span>
          <h2>{lang === "th" ? <>การดูแลของคุณ<br />กำลังผลิบาน</> : <>Your care is<br />taking shape.</>}</h2>
          <p>
            {!alive
              ? (lang === "th" ? "ไม่ได้รดน้ำเกิน 3 วัน หรือมีการซื้อเสื้อผ้าใหม่ ปลูกต้นใหม่เพื่อเริ่มอีกครั้ง" : "It went 3 days without water, or you bought new clothes without a buying credit. Plant a new seed to begin again.")
              : stage === 5
                ? (lang === "th" ? `ฝ้ายเต็มที่แล้ว ดูแลมา ${caredDays} วัน รักษาความสม่ำเสมอต่อไป` : `Your cotton is full. ${caredDays} cared-for days and counting.`)
                : (lang === "th" ? `ดูแลต่ออีก ${daysLeft} วัน ต้นฝ้ายจะเติบโตเต็มที่ รักษาความสม่ำเสมอในทุกวัน` : `${daysLeft} more cared-for days until your cotton is full. Keep the rhythm gentle and consistent.`)}
          </p>
          <div className="hero-stats" data-tour="plant-stats">
            <div>
              <strong>{state.plant.streak}</strong>
              <span>day streak</span>
            </div>
            <div>
              <strong>{state.profile.buyingCredits}</strong>
              <span>buying credit</span>
            </div>
            <div>
              <strong>{String(daysLeft).padStart(2, "0")}</strong>
              <span>days to full</span>
            </div>
          </div>
        </div>
        <PlantArtwork stage={stage} alive={alive} />
      </section>

      <section className="care-card">
        <div className="care-main">
          <div className={`water-icon ${watered ? "done" : ""}`}>
            {watered ? <Check size={24} /> : <Droplets size={24} />}
          </div>
          <div>
            <span className="card-kicker">{!alive ? "Your cotton needs a fresh start" : watered ? "Today’s care is complete" : "Your cotton is ready"}</span>
            <h3>{!alive ? "Time to replant" : watered ? "Watered and thriving" : "A little water goes far"}</h3>
            <p>{!alive ? "Your points and closet are safe." : watered ? "Come back tomorrow to continue your streak." : "Water once today before midnight."}</p>
          </div>
        </div>
        {alive ? (
          <button data-tour="water" className={`primary-button ${watered ? "complete" : ""}`} onClick={() => !watered && onWater()}>
            {watered ? <Check size={18} /> : <Droplets size={18} />}
            {watered ? (lang === "th" ? "รดน้ำแล้ววันนี้" : "Watered today") : (lang === "th" ? "รดน้ำต้นฝ้าย" : "Water cotton")}
          </button>
        ) : (
          <button className="primary-button" onClick={onReplant}>
            <Leaf size={18} />
            {lang === "th" ? "ปลูกต้นใหม่" : "Plant a new seed"}
          </button>
        )}
      </section>

      <section className="progress-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Growth journey</span>
            <h3>From seed to soft cotton</h3>
          </div>
          <span className="progress-count">{Math.min(caredDays, DAYS_TO_FULL)} / {DAYS_TO_FULL} days</span>
        </div>
        <div className="stage-track" data-tour="journey">
          <div className="track-line" style={{ left: "10%", right: "10%" }}><span style={{ width: `${alive ? journeyProgress(caredDays) * 100 : 0}%`, transition: "width .4s ease" }} /></div>
          {stageSteps.map((step, index) => (
            <div className={`stage ${alive && index < stage ? "active" : ""}`} key={step.label}>
              <div className="stage-dot">{alive && index < stage - 1 ? <Check size={13} /> : index + 1}</div>
              <strong>{step.label}</strong>
              <span>Days {step.range}</span>
            </div>
          ))}
        </div>
      </section>

      <button className="fact-bar" data-tour="funfact" onClick={() => setFactOpen(true)}>
        <span className="fact-mark"><Leaf size={17} /></span>
        <span>
          <small>Today’s thread</small>
          The equivalent of one garbage truck of textiles is landfilled every second.
        </span>
        <ArrowRight size={19} />
      </button>

      {factOpen && (
        <div className="overlay" onClick={() => setFactOpen(false)}>
          <article className="sheet fact-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setFactOpen(false)} aria-label="Close">
              <X size={20} />
            </button>
            <span className="fact-large-mark"><Leaf size={25} /></span>
            <span className="eyebrow">Today’s thread · 02</span>
            <h2>Small wardrobe choices have a long afterlife.</h2>
            <p>
              Extending the active life of clothing through care, repair, and reuse is one of the simplest ways to
              reduce its environmental footprint.
            </p>
            <a className="article-link" href="https://www.unep.org/news-and-stories/story/environmental-costs-fast-fashion" target="_blank" rel="noreferrer">
              Read the UNEP story <ExternalLink size={16} />
            </a>
          </article>
        </div>
      )}
    </div>
  );
}

/** Pick a photo → background removed → color detected. Used when adding AND editing a piece. */
function GarmentPhotoPicker({ image, placeholder, onResult, onBusy, onNote, compact }: { image: string; placeholder?: boolean; onResult: (image: string, color: string) => void; onBusy?: (busy: boolean) => void; onNote?: (note: string) => void; compact?: boolean }) {
  const { lang } = useLanguage();
  const [busy, setBusy] = useState("");
  const setNote = (note: string) => onNote?.(note);
  const handle = async (file: File) => {
    setNote("");
    onBusy?.(true);
    setBusy(lang === "th" ? "กำลังประมวลผลรูป…" : "Preparing photo…");
    try {
      const result = await prepareGarmentPhoto(file, (message) => setBusy(message));
      onResult(result.image, result.color);
      setNote(result.backgroundRemoved
        ? (lang === "th" ? `ลบพื้นหลังแล้ว · ตรวจพบสี ${result.color}` : `Background removed · color detected: ${result.color}`)
        : (lang === "th" ? `ลบพื้นหลังไม่สำเร็จ (ใช้รูปเดิม) · สีโดยประมาณ ${result.color}` : `Couldn’t remove the background (kept your photo) · rough color: ${result.color}`));
    } catch {
      setNote(lang === "th" ? "เปิดรูปนี้ไม่ได้ ลองรูปอื่น" : "Couldn’t open that image. Try another photo.");
    } finally {
      setBusy("");
      onBusy?.(false);
    }
  };
  return (
    <>
      <label className={compact ? "secondary-button" : "capture-box file-capture"} style={compact ? { display: "inline-flex", gap: 8, alignItems: "center", cursor: busy ? "wait" : "pointer" } : undefined}>
        <input type="file" accept="image/*" disabled={!!busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) handle(file); }} />
        {compact ? <Upload size={16} /> : !placeholder ? <img src={image} alt="Garment preview" style={{ objectFit: "contain", background: "var(--sage-light)" }} /> : <Upload size={25} />}
        <span>{busy || (compact ? (lang === "th" ? "เปลี่ยนรูป" : "Change photo") : (lang === "th" ? "อัปโหลดรูปเสื้อผ้า" : "Upload garment"))}</span>
      </label>
    </>
  );
}

function GarmentCard({ garment, onClick, onDragStart, onDragEnd }: {
  garment: Garment;
  onClick: () => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const { lang } = useLanguage();
  const displayName = garmentName(garment, lang);
  return (
    <button className="garment-card" draggable onClick={onClick} onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label={`Drag ${displayName} to move it, or click to view details`} title={`Drag to move ${displayName}; click for details`}>
      <span className="hanger-hook" />
      <img src={garment.image} alt={displayName} style={{ objectFit: "contain", background: "var(--sage-light)" }} />
      <span className="garment-info">
        <span className="color-dot" data-color={garment.color.toLowerCase()} style={{ background: colorCss(garment.color) }} />
        <span>
          <strong>{displayName}</strong>
          <small>{garment.material}</small>
        </span>
      </span>
    </button>
  );
}

function GarmentDetailSheet({
  garment,
  closets,
  onClose,
  onSave,
  onDelete,
}: {
  garment: Garment;
  closets: string[];
  onClose: () => void;
  onSave: (changes: Partial<Garment>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { lang } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [draft, setDraft] = useState(garment);
  const fields: [keyof Garment, string][] = [
    ["name", "Name"],
    ["type", "Type"],
    ["owner", "Owner"],
    ["components", "Composition"],
    ["color", "Color"],
    ["style", "Style"],
    ["occasion", "Occasion"],
    ["closet", "Closet"],
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet detail-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="detail-image"><img src={editing ? draft.image : garment.image} alt={garmentName(garment, lang)} style={{ objectFit: "contain" }} /><span>{garment.wearCount || 0} {lang === "th" ? "ครั้งที่ใส่" : "wears"}</span></div>
        <div className="detail-content">
          <span className="eyebrow">{garment.closet} closet</span>
          {editing ? (
            <div className="detail-edit-grid">
              <div className="wide" style={{ display: "grid", gap: 6 }}>
                <GarmentPhotoPicker compact image={draft.image} onNote={setPhotoNote} onResult={(image, color) => setDraft((current) => ({ ...current, image, color }))} />
                {photoNote && <small role="status" style={{ color: "var(--ink-soft)" }}>{photoNote}</small>}
              </div>
              {fields.map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  {key === "closet" ? (
                    <select value={closetOf(draft, closets)} onChange={(event) => setDraft({ ...draft, closet: event.target.value })}>{closets.map((name) => <option key={name}>{name}</option>)}</select>
                  ) : (
                    <input value={String(draft[key] || "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
                  )}
                </label>
              ))}
              <label className="wide"><span>Care notes</span><textarea value={draft.notes || ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            </div>
          ) : (
            <>
              <h2>{garmentName(garment, lang)}</h2>
              <p>{lang === "th" ? "เสื้อผ้าชิ้นโปรดที่พร้อมกลับมาใส่ซ้ำได้เสมอ" : (garment.notes || "A loved part of your circular wardrobe.")}</p>
              <div className="detail-facts">
                {fields.slice(1).map(([key, label]) => <span key={key}><small>{label}</small><strong>{String(garment[key] || "Not set")}</strong></span>)}
              </div>
            </>
          )}
          <div className="detail-actions">
            <button className="danger-button" onClick={onDelete}><Trash2 size={17} /> Delete</button>
            {editing ? (
              <button className="primary-button" onClick={async () => { await onSave(draft); setEditing(false); }}><Check size={17} /> Save changes</button>
            ) : (
              <button className="primary-button" onClick={() => setEditing(true)}><Pencil size={17} /> Edit piece</button>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function AddGarmentSheet({
  closets,
  defaultOwner,
  onClose,
  onAdd,
}: {
  closets: string[];
  defaultOwner: string;
  onClose: () => void;
  onAdd: (garment: Garment) => void;
}) {
  const { lang } = useLanguage();
  const [scanNote, setScanNote] = useState("");
  const [scanning, setScanning] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [draft, setDraft] = useState<Garment>({
    id: "",
    name: "",
    type: "Shirt",
    owner: defaultOwner,
    components: "",
    material: "",
    color: "",
    style: "Minimal",
    occasion: "Everyday",
    closet: DEFAULT_CLOSET,
    image: photos.linen,
    notes: "",
  });

  const update = (key: keyof Garment, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const scanTag = async (file: File) => {
    setScanning(true);
    setScanNote("");
    try {
      const text = await readTagText(file, (message) => setScanNote(message));
      const composition = parseComposition(text);
      if (composition) {
        setDraft((current) => ({ ...current, components: composition, material: composition }));
        setScanNote(lang === "th" ? `อ่านป้ายแล้ว: ${composition} กรุณาตรวจสอบ` : `Tag read: ${composition}. Please double-check it.`);
      } else {
        setScanNote(lang === "th" ? "อ่านส่วนประกอบจากป้ายไม่ได้ ลองถ่ายให้ชัดขึ้น หรือพิมพ์เอง" : "Couldn’t find a fabric composition. Try a sharper, well-lit photo, or type it in.");
      }
    } catch (error) {
      console.warn("Tag scan failed", error);
      setScanNote(lang === "th" ? "สแกนป้ายไม่สำเร็จ ลองใหม่หรือพิมพ์เอง" : "Tag scan failed. Try again, or type the composition in.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet garment-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <span className="eyebrow">{lang === "th" ? "เสื้อผ้าชิ้นใหม่" : "New wardrobe piece"}</span>
            <h2>{lang === "th" ? "เพิ่มลงตู้เสื้อผ้า" : "Add to your closet"}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="capture-grid">
          <GarmentPhotoPicker image={draft.image} placeholder={draft.image === photos.linen} onBusy={setPhotoBusy} onNote={setPhotoNote} onResult={(image, color) => setDraft((current) => ({ ...current, image, color }))} />
          <label className="capture-box scan" style={{ cursor: scanning ? "wait" : "pointer" }}>
            <input type="file" accept="image/*" capture="environment" hidden disabled={scanning} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) scanTag(file); }} />
            <Camera size={25} />
            <span>{scanning ? (lang === "th" ? "กำลังอ่านป้าย…" : "Reading tag…") : (lang === "th" ? "สแกนป้ายเสื้อผ้า" : "Scan care tag")}</span>
          </label>
        </div>
        {photoNote && <small role="status" style={{ color: "var(--ink-soft)" }}>{photoNote}</small>}
        {scanNote && <div className="scan-success" role="status"><WandSparkles size={17} /> {scanNote}</div>}
        <div className="form-grid">
          <label>
            <span>{lang === "th" ? "ชื่อเสื้อผ้า" : "Piece name"}</span>
            <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder={lang === "th" ? "เช่น แจ็กเก็ตสีเขียว" : "e.g. Sage utility jacket"} />
          </label>
          <label>
            <span>{lang === "th" ? "ประเภท" : "Clothing type"}</span>
            <select value={draft.type} onChange={(event) => update("type", event.target.value)}>
              {["Shirt", "T-shirt", "Blouse", "Sweater", "Hoodie", "Jacket", "Coat", "Dress", "Skirt", "Pants", "Jeans", "Shorts", "Other"].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>{lang === "th" ? "เจ้าของ" : "Owner"}</span>
            <input value={draft.owner} onChange={(event) => update("owner", event.target.value)} />
          </label>
          <label>
            <span>{lang === "th" ? "ส่วนประกอบ" : "Composition"}</span>
            <input value={draft.components} onChange={(event) => { update("components", event.target.value); update("material", event.target.value); }} placeholder="e.g. 100% cotton" />
          </label>
          <label>
            <span>{lang === "th" ? "สี" : "Color"}</span>
            <input value={draft.color} onChange={(event) => update("color", event.target.value)} placeholder={lang === "th" ? "ตรวจจับอัตโนมัติ" : "Auto-detected"} />
          </label>
          <label>
            <span>{lang === "th" ? "สไตล์" : "Style"}</span>
            <select value={draft.style} onChange={(event) => update("style", event.target.value)}>{["Minimal", "Street", "Classic", "Casual", "Vintage", "Sporty", "Bohemian"].map((style) => <option key={style}>{style}</option>)}</select>
          </label>
          <label>
            <span>{lang === "th" ? "โอกาส" : "Occasion"}</span>
            <select value={draft.occasion} onChange={(event) => update("occasion", event.target.value)}>{["Everyday", "Casual", "Formal", "Work", "Party", "Sport"].map((occasion) => <option key={occasion}>{occasion}</option>)}</select>
          </label>
          <label>
            <span>{lang === "th" ? "ตู้เสื้อผ้า" : "Closet"}</span>
            <select value={draft.closet} onChange={(event) => update("closet", event.target.value)}>{closets.map((name) => <option key={name}>{name}</option>)}</select>
          </label>
        </div>
        <button
          className="primary-button full"
          disabled={!draft.name.trim() || draft.image === photos.linen || photoBusy || scanning}
          onClick={() => onAdd({ ...draft, id: Date.now(), name: draft.name.trim() })}
        >
          <Plus size={18} /> {lang === "th" ? `เพิ่มลง ${draft.closet}` : `Add to ${draft.closet}`}
        </button>
        {draft.image === photos.linen && <small style={{ color: "var(--ink-soft)", textAlign: "center" }}>{lang === "th" ? "อัปโหลดรูปเสื้อผ้าและตั้งชื่อเพื่อเพิ่ม" : "Upload a photo and give it a name to add it."}</small>}
      </article>
    </div>
  );
}

function ClosetFilterSheet({
  types,
  colors,
  closets,
  onClose,
  onApply,
}: {
  types: string[];
  colors: string[];
  closets: string[];
  onClose: () => void;
  onApply: (filters: { type: string; closet: string; color: string }) => void;
}) {
  const { lang } = useLanguage();
  const [filters, setFilters] = useState({ type: "", closet: "", color: "" });
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "ค้นหาให้เร็วขึ้น" : "Narrow your closet"}</span><h2>{lang === "th" ? "ตัวกรองเสื้อผ้า" : "Filter pieces"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="filter-options">
          <label><span>{lang === "th" ? "ประเภท" : "Type"}</span><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">{lang === "th" ? "ทุกประเภท" : "All types"}</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>{lang === "th" ? "ตู้เสื้อผ้า" : "Closet"}</span><select value={filters.closet} onChange={(event) => setFilters({ ...filters, closet: event.target.value })}><option value="">{lang === "th" ? "ทุกตู้" : "All closets"}</option>{closets.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label><span>{lang === "th" ? "สี" : "Color"}</span><select value={filters.color} onChange={(event) => setFilters({ ...filters, color: event.target.value })}><option value="">{lang === "th" ? "ทุกสี" : "All colors"}</option>{colors.map((color) => <option key={color}>{color}</option>)}</select></label>
        </div>
        <div className="filter-actions"><button className="secondary-button" onClick={() => setFilters({ type: "", closet: "", color: "" })}>{lang === "th" ? "ล้างทั้งหมด" : "Clear all"}</button><button className="primary-button" onClick={() => { onApply(filters); onClose(); }}><SlidersHorizontal size={17} /> {lang === "th" ? "ใช้ตัวกรอง" : "Apply filters"}</button></div>
      </article>
    </div>
  );
}

function NewClosetSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => string | null }) {
  const { lang } = useLanguage();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const problem = onCreate(name);
    if (problem) setError(problem);
    else onClose();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "จัดระเบียบเสื้อผ้า" : "Organise your pieces"}</span><h2>{lang === "th" ? "ตู้เสื้อผ้าใหม่" : "New closet"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="filter-options">
          <label><span>{lang === "th" ? "ชื่อตู้" : "Closet name"}</span><input autoFocus maxLength={24} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={lang === "th" ? "เช่น ชุดทำงาน" : "e.g. Work, Travel, Summer"} /></label>
          {error && <div role="alert" style={{ color: "#b3261e", fontSize: 14 }}>{error}</div>}
        </div>
        <div className="filter-actions"><button className="secondary-button" onClick={onClose}>{lang === "th" ? "ยกเลิก" : "Cancel"}</button><button className="primary-button" disabled={!name.trim()} onClick={submit}><FolderPlus size={17} /> {lang === "th" ? "สร้างตู้" : "Create closet"}</button></div>
      </article>
    </div>
  );
}

function WardrobeView({
  garments,
  closets,
  onAdd,
  onUpdate,
  onDelete,
  onAddCloset,
  onDeleteCloset,
}: {
  garments: Garment[];
  closets: string[];
  onAdd: () => void;
  onUpdate: (id: Garment["id"], changes: Partial<Garment>) => Promise<void>;
  onDelete: (id: Garment["id"]) => Promise<void>;
  onAddCloset: (name: string) => string | null;
  onDeleteCloset: (name: string) => void;
}) {
  const { lang, t } = useLanguage();
  const [naming, setNaming] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Garment | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ type: "", closet: "", color: "" });
  const [draggedGarmentId, setDraggedGarmentId] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const didDrag = useRef(false);
  const filtered = garments.filter((garment) =>
    garment.name.toLowerCase().includes(query.toLowerCase()) &&
    (!filters.type || garment.type === filters.type) &&
    (!filters.closet || closetOf(garment, closets) === filters.closet) &&
    (!filters.color || garment.color === filters.color)
  );
  const filtering = Object.values(filters).some(Boolean);
  const naturalShare = naturalFiberShare(garments.map((garment) => garment.components || garment.material || ""));

  return (
    <>
      <div className="closet-toolbar" data-tour="closet-tools">
        <label className="search-field">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />
        </label>
        <button className={`filter-button ${Object.values(filters).some(Boolean) ? "active" : ""}`} onClick={() => setFilterOpen(true)}><SlidersHorizontal size={18} /><span>{lang === "th" ? "ตัวกรอง" : "Filter"}</span></button>
        <button className="primary-button add-button" data-tour="add-piece" onClick={onAdd}><Plus size={18} /> {t.addPiece}</button>
      </div>
      <div className="closet-summary">
        <span><strong>{garments.length}</strong> pieces</span>
        <span><strong>{closets.length}</strong> closets</span>
        <span><strong>{naturalShare === null ? "–" : `${naturalShare}%`}</strong> natural fibers</span>
        <button className="secondary-button" data-tour="new-closet" onClick={() => setNaming(true)} style={{ marginLeft: "auto" }}><FolderPlus size={16} /> {lang === "th" ? "ตู้ใหม่" : "New closet"}</button>
      </div>
      {closets.map((closet) => {
        const closetItems = filtered.filter((garment) => closetOf(garment, closets) === closet);
        if (!closetItems.length && (query || filtering)) return null;
        const movedCount = garments.filter((garment) => closetOf(garment, closets) === closet).length;
        return (
          <section className="wardrobe-unit" key={closet}>
            <div className="wardrobe-top" data-tour={closet === closets[0] ? "closet-shelf" : undefined}>
              <div>
                <span className="eyebrow">{closet === DEFAULT_CLOSET ? (lang === "th" ? "ตู้หลัก" : "Default closet") : "Your collection"}</span>
                <h3>{closet}</h3>
              </div>
              <span className="closet-hint" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {lang === "th" ? "ลากเสื้อผ้าเพื่อย้าย · แตะเพื่อดูรายละเอียด" : "Drag pieces to move · Tap for details"}
                {closet !== DEFAULT_CLOSET && (
                  <button
                    className="secondary-button"
                    aria-label={`Delete ${closet}`}
                    title={lang === "th" ? "ลบตู้นี้" : "Delete closet"}
                    onClick={() => {
                      const message = lang === "th"
                        ? `ลบตู้ "${closet}" ? เสื้อผ้า ${movedCount} ชิ้นจะย้ายไปที่ "${DEFAULT_CLOSET}"`
                        : `Delete "${closet}"? Its ${movedCount} piece${movedCount === 1 ? "" : "s"} will move to "${DEFAULT_CLOSET}".`;
                      if (window.confirm(message)) onDeleteCloset(closet);
                    }}
                    style={{ padding: "6px 8px" }}
                  ><Trash2 size={15} /></button>
                )}
              </span>
            </div>
            <div
              className={`wardrobe-rail ${dropTarget === closet ? "drop-target" : ""}`}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={() => setDropTarget(closet)}
              onDragLeave={(event) => {
                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget("");
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || draggedGarmentId;
                const moving = garments.find((garment) => String(garment.id) === id);
                if (moving && closetOf(moving, closets) !== closet) void onUpdate(moving.id, { closet });
                setDraggedGarmentId("");
                setDropTarget("");
              }}
            >
              {closetItems.length ? closetItems.map((garment) => <GarmentCard
                garment={garment}
                key={garment.id}
                onClick={() => {
                  if (didDrag.current) return;
                  setSelected(garment);
                }}
                onDragStart={(event) => {
                  didDrag.current = true;
                  setDraggedGarmentId(String(garment.id));
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(garment.id));
                }}
                onDragEnd={() => {
                  setDraggedGarmentId("");
                  setDropTarget("");
                  window.setTimeout(() => { didDrag.current = false; }, 200);
                }}
              />) : (
                <button className="empty-closet" onClick={onAdd}><Plus size={22} /><span>Add your first piece</span></button>
              )}
            </div>
          </section>
        );
      })}
      {naming && <NewClosetSheet onClose={() => setNaming(false)} onCreate={onAddCloset} />}
      {selected && (
        <GarmentDetailSheet
          garment={selected}
          closets={closets}
          onClose={() => setSelected(null)}
          onSave={async (changes) => {
            await onUpdate(selected.id, changes);
            setSelected({ ...selected, ...changes });
          }}
          onDelete={async () => {
            await onDelete(selected.id);
            setSelected(null);
          }}
        />
      )}
      {filterOpen && <ClosetFilterSheet types={[...new Set(garments.map((garment) => garment.type))]} colors={[...new Set(garments.map((garment) => garment.color).filter(Boolean))].sort()} closets={closets} onClose={() => setFilterOpen(false)} onApply={setFilters} />}
    </>
  );
}

function ReferenceStyleSheet({ onClose, onMatch }: { onClose: () => void; onMatch: () => void }) {
  const { lang } = useLanguage();
  const [image, setImage] = useState("");
  const [style, setStyle] = useState("Minimal");
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet reference-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "แรงบันดาลใจของคุณ" : "Your inspiration"}</span><h2>{lang === "th" ? "เพิ่มรูปอ้างอิง" : "Add a reference"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <label className="reference-upload"><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); }} />{image ? <img src={image} alt="Style reference" /> : <div className="reference-upload-placeholder"><Upload size={22} /><span>{lang === "th" ? "อัปโหลดรูปอ้างอิง" : "Upload a reference photo"}</span></div>}<span><Upload size={17} /> {lang === "th" ? "อัปโหลดรูปอ้างอิง" : "Upload reference photo"}</span></label>
        <div className="reference-styles"><span>{lang === "th" ? "สไตล์ที่ต้องการ" : "Style direction"}</span><div>{["Minimal", "Street", "Classic", "Formal"].map((item) => <button className={style === item ? "active" : ""} onClick={() => setStyle(item)} key={item}>{item}</button>)}</div></div>
        <button className="primary-button full" onClick={() => { onMatch(); onClose(); }}><WandSparkles size={18} /> {lang === "th" ? "ค้นหาชุดจากตู้ของฉัน" : "Match from my closet"}</button>
      </article>
    </div>
  );
}

function MatchView({ garments, userId, currentMember, onPurchase, onDelete }: {
  garments: Garment[];
  userId: string;
  currentMember: Pick<CommunityFriend, "name" | "handle" | "avatar">;
  onPurchase: (listing: MarketplaceListing, method: DemoPaymentMethod) => Promise<void>;
  onDelete: (listing: MarketplaceListing) => Promise<void>;
}) {
  const { lang } = useLanguage();
  const { listings } = useMarketplaceListings(lang);
  const [generated, setGenerated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const matchedListings = listings.map((listing) => {
    const score = garments.reduce((total, garment) => {
      const sameType = garment.type.toLocaleLowerCase() === listing.type.toLocaleLowerCase();
      const sameStyle = Boolean(garment.style && garment.style.toLocaleLowerCase() === listing.style.toLocaleLowerCase());
      const tags = [garment.name, garment.type, garment.material, garment.color, garment.style, garment.occasion].filter(Boolean).map((part) => part!.toLocaleLowerCase());
      const listingText = [listing.material, listing.style, ...listing.tags].join(" ").toLocaleLowerCase();
      const sharedTags = tags.filter((tag) => listingText.includes(tag)).length;
      return Math.max(total, (sameType ? 3 : 0) + (sameStyle ? 3 : 0) + sharedTags);
    }, 0);
    return { listing, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(({ listing }) => listing);
  return (
    <div className="match-layout">
      <section className="match-intro">
        <span className="status-pill"><Sparkles size={15} /> Wardrobe-first styling</span>
        <h2>Make more from<br />what you own.</h2>
        <p>Build a look yourself, or add a reference and let Reweave find the closest match in your closet.</p>
        <button className="primary-button" data-tour="lets-match" disabled={!garments.length} onClick={() => setGenerated(true)}>
          <WandSparkles size={18} /> Let’s match
        </button>
        {!garments.length && <small style={{ color: "var(--ink-soft)" }}>Add a few pieces to your closet first.</small>}
      </section>
      <section className="outfit-board">
        <div className="board-heading">
          <div><span className="eyebrow">{generated ? "96% from your closet" : "Tap a piece to begin"}</span><h3>{generated ? "Soft city layers" : "New outfit"}</h3></div>
          <button className="icon-button"><MoreHorizontal size={20} /></button>
        </div>
        <div className="outfit-canvas">
          {(generated ? garments.slice(0, 3) : garments.slice(0, 2)).map((garment, index) => (
            <button className={`outfit-piece piece-${index + 1}`} key={garment.id}>
              <img src={garment.image} alt={garment.name} />
              <span>{garment.name}</span>
            </button>
          ))}
          {!generated && <button className="add-outfit-piece"><Plus size={21} /><span>Add layer</span></button>}
        </div>
        <div className="board-actions">
          <button className="secondary-button" onClick={() => setReferenceOpen(true)}><Upload size={17} /> Add reference</button>
          <button className="primary-button" onClick={() => setSaved(true)}>
            {saved ? <Check size={17} /> : <Heart size={17} />}
            {saved ? "Saved" : "Save look"}
          </button>
        </div>
      </section>
      {generated && <section className="match-market-results">
        <div><span className="eyebrow">{lang === "th" ? "จับคู่จากร้านสมาชิก" : "Member shop matches"}</span><h3>{lang === "th" ? "เสื้อผ้ามือสองที่เข้ากับตู้ของคุณ" : "Secondhand pieces that fit your wardrobe"}</h3></div>
        {!matchedListings.length && <p>{lang === "th" ? "ยังไม่พบรายการที่ตรงกับเสื้อผ้าในตู้ของคุณ" : "No member listings match the pieces in your closet yet."}</p>}
        <div className="match-listings">{matchedListings.map((listing) => <button className="match-listing" key={listing.id} onClick={() => setSelectedListing(listing)}><img src={listing.image} alt="" /><span><strong>{listing.name}</strong><small>{listing.style} · {listing.tags.join(" · ")}</small><b>฿{listing.price.toLocaleString()}</b></span><ArrowRight size={18} /></button>)}</div>
      </section>}
      {referenceOpen && <ReferenceStyleSheet onClose={() => setReferenceOpen(false)} onMatch={() => setGenerated(true)} />}
      {selectedListing && <ListingDetailSheet listing={selectedListing} userId={userId} currentMember={currentMember} onClose={() => setSelectedListing(null)} onPurchase={onPurchase} onDelete={onDelete} />}
    </div>
  );
}

function ClosetView({
  state,
  userId,
  onCreate,
  onUpdate,
  onDelete,
  onAddCloset,
  onDeleteCloset,
  onPurchase,
  onDeleteListing,
}: {
  state: DemoState;
  userId: string;
  onCreate: (garment: Garment) => Promise<void>;
  onUpdate: (id: Garment["id"], changes: Partial<Garment>) => Promise<void>;
  onDelete: (id: Garment["id"]) => Promise<void>;
  onAddCloset: (name: string) => string | null;
  onDeleteCloset: (name: string) => void;
  onPurchase: (listing: MarketplaceListing, method: DemoPaymentMethod) => Promise<void>;
  onDeleteListing: (listing: MarketplaceListing) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ClosetTab>("wardrobe");
  const [adding, setAdding] = useState(false);

  const addGarment = async (garment: Garment) => {
    await onCreate(garment);
    setAdding(false);
  };

  return (
    <div className="page">
      <div className="segmented">
        <button data-tour="wardrobe-tab" className={tab === "wardrobe" ? "active" : ""} onClick={() => setTab("wardrobe")}><Shirt size={17} /> {t.myCloset}</button>
        <button data-tour="match-tab" className={tab === "match" ? "active" : ""} onClick={() => setTab("match")}><Sparkles size={17} /> {t.match}</button>
      </div>
      {tab === "wardrobe" ? (
        <WardrobeView garments={state.garments} closets={state.closets} onAdd={() => setAdding(true)} onUpdate={onUpdate} onDelete={onDelete} onAddCloset={onAddCloset} onDeleteCloset={onDeleteCloset} />
      ) : (
        <MatchView garments={state.garments} userId={userId} currentMember={{ name: state.profile.displayName, handle: state.profile.username, avatar: state.profile.avatar }} onPurchase={onPurchase} onDelete={onDeleteListing} />
      )}
      {adding && <AddGarmentSheet closets={state.closets} defaultOwner={state.profile.displayName} onClose={() => setAdding(false)} onAdd={addGarment} />}
    </div>
  );
}

function CommunityProfileSheet({ profileId, userId, currentMember, name, handle, image, bio, onClose }: { profileId: string; userId: string; currentMember: Pick<CommunityFriend, "name" | "handle" | "avatar">; name: string; handle: string; image: string; bio?: string; onClose: () => void }) {
  const { lang } = useLanguage();
  const isSelf = profileId === userId;
  const [posts, setPosts] = useState<FashionPost[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [following, setFollowing] = useState(false);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending_sent" | "pending_received" | "friends">("none");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [relationshipLoading, setRelationshipLoading] = useState(!isSelf);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const stopPosts = subscribeCommunityPosts((items) => {
      setPosts(items.filter((post) => post.ownerId === profileId && post.privacy === "public"));
      setLoading(false);
    }, (loadError) => {
      console.error("Could not load member profile posts", loadError);
      setError(lang === "th" ? "โหลดโพสต์ของสมาชิกไม่สำเร็จ" : "Could not load this member’s posts.");
      setLoading(false);
    });
    const stopListings = subscribeMarketplaceListings((items) => {
      setListings(items
        .map((listing) => ({ ...listing, tags: Array.isArray(listing.tags) ? listing.tags : [] }))
        .filter((listing) => listing.sellerId === profileId && !listing.sold));
    }, (loadError) => {
      console.error("Could not load member profile listings", loadError);
      setError(lang === "th" ? "โหลดรายการขายของสมาชิกไม่สำเร็จ" : "Could not load this member’s listings.");
    });
    return () => {
      stopPosts();
      stopListings();
    };
  }, [lang, profileId]);

  useEffect(() => {
    if (isSelf || !profileId) return;
    let active = true;
    setRelationshipLoading(true);
    getCommunityRelationship(userId, profileId).then((relationship) => {
      if (!active) return;
      setFollowing(relationship.following);
      setFriendStatus(relationship.friendStatus);
    }).catch((relationshipError) => {
      console.error("Could not load member relationship", relationshipError);
      if (active) setError(lang === "th"
        ? "โหลดสถานะเพื่อนและการติดตามไม่สำเร็จ ตรวจสอบกฎ Firestore"
        : "Could not load follow or friend status. Check the Firestore rules.");
    }).finally(() => {
      if (active) setRelationshipLoading(false);
    });
    return () => { active = false; };
  }, [isSelf, lang, profileId, userId]);

  const toggleFollow = async () => {
    setBusy(true);
    setError("");
    try {
      await setCommunityFollow(userId, profileId, following);
      setFollowing(!following);
    } catch (followError) {
      console.error("Could not update member follow", followError);
      setError(lang === "th" ? "ติดตามสมาชิกไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not update follow. Check the Firestore rules and try again.");
    } finally {
      setBusy(false);
    }
  };

  const addFriend = async () => {
    setBusy(true);
    setError("");
    try {
      if (friendStatus === "pending_received") {
        await acceptCommunityFriendRequest(userId, profileId, currentMember);
        setFriendStatus("friends");
      } else {
        await sendCommunityFriendRequest(userId, profileId, currentMember);
        setFriendStatus("pending_sent");
      }
    } catch (friendError) {
      console.error("Could not send friend request", friendError);
      setError(lang === "th"
        ? "ส่งคำขอเป็นเพื่อนไม่สำเร็จ โปรดเพิ่มกฎ Firestore สำหรับคำขอเป็นเพื่อน"
        : "Could not update friend request. Add the friend-request Firestore rules and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay social-profile-overlay" onClick={onClose}>
      <article className="sheet social-profile-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose}><X size={20} /></button>
        <div className="social-profile-cover">{image && <img src={image} alt="" />}</div>
        <div className="social-profile-head">
          <span className="large-avatar">{image ? <img src={image} alt="" /> : name.slice(0, 1)}</span>
          <div className="social-profile-name"><h2>{name}</h2><p>{handle}</p></div>
          {!isSelf && <div className="social-profile-actions">
            <button className={following ? "secondary-button" : "primary-button"} disabled={busy || relationshipLoading} onClick={() => void toggleFollow()}>
              {following ? <Check size={16} /> : <Users size={16} />}{following ? (lang === "th" ? "กำลังติดตาม" : "Following") : (lang === "th" ? "ติดตาม" : "Follow")}
            </button>
            <button className="secondary-button" disabled={busy || relationshipLoading || friendStatus === "pending_sent" || friendStatus === "friends"} onClick={() => void addFriend()}>
              {friendStatus === "friends" ? <Check size={16} /> : <UserPlus size={16} />}
              {friendStatus === "friends" ? (lang === "th" ? "เพื่อนแล้ว" : "Friends") : friendStatus === "pending_sent" ? (lang === "th" ? "ส่งคำขอแล้ว" : "Request sent") : friendStatus === "pending_received" ? (lang === "th" ? "ยอมรับคำขอ" : "Accept request") : (lang === "th" ? "เพิ่มเพื่อน" : "Add friend")}
            </button>
          </div>}
        </div>
        {bio && <p className="profile-bio">{bio}</p>}
        <div className="social-stats">
          <span><strong>{posts.length}</strong>{lang === "th" ? "โพสต์สาธารณะ" : "public posts"}</span>
          <span><strong>{listings.length}</strong>{lang === "th" ? "รายการขาย" : "items for sale"}</span>
        </div>
        {error && <p className="profile-action-error" role="alert">{error}</p>}
        <section className="social-profile-section">
          <div className="section-heading"><div><span className="eyebrow">{lang === "th" ? "สไตล์จากชุมชน" : "Community style"}</span><h3>{lang === "th" ? "โพสต์" : "Posts"}</h3></div></div>
          {loading && <p className="feed-empty">{lang === "th" ? "กำลังโหลด..." : "Loading..."}</p>}
          {!loading && !posts.length && <p className="feed-empty">{lang === "th" ? "ยังไม่มีโพสต์สาธารณะ" : "No public posts yet."}</p>}
          {!!posts.length && <div className="profile-grid">{posts.map((post) => <article className="profile-post-tile" key={post.id}>
            <img src={post.image} alt={post.look} />
            <div><strong>{post.look}</strong><span><Heart size={13} /> {post.likedBy?.length ?? post.likes} · <MessageCircle size={13} /> {post.comments?.length ?? 0}</span></div>
          </article>)}</div>}
        </section>
        <section className="social-profile-section">
          <div className="section-heading"><div><span className="eyebrow">{lang === "th" ? "เสื้อผ้าหมุนเวียน" : "Pre-loved pieces"}</span><h3>{lang === "th" ? "กำลังขาย" : "Selling"}</h3></div></div>
          {!listings.length && <p className="feed-empty">{lang === "th" ? "ไม่มีรายการกำลังขาย" : "No active listings."}</p>}
          {!!listings.length && <div className="profile-listing-grid">{listings.map((listing) => <article className="profile-listing-card" key={listing.id}>
            <img src={listing.image} alt={listing.name} />
            <div><small>{listing.type} · {listing.size} · {listing.style}</small><strong>{listing.name}</strong><b>฿{listing.price.toLocaleString()}</b>
              <div className="listing-tags">{listing.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>
          </article>)}</div>}
        </section>
      </article>
    </div>
  );
}

function PostComposer({
  garments,
  profile,
  userId,
  initial,
  onClose,
  onSave,
}: {
  garments: Garment[];
  profile: Profile;
  userId: string;
  initial?: FashionPost;
  onClose: () => void;
  onSave: (post: FashionPost) => Promise<void>;
}) {
  const { lang } = useLanguage();
  const [draft, setDraft] = useState<FashionPost>(() => initial || {
    id: createCommunityId(), ownerId: userId, name: profile.displayName, handle: profile.username, avatar: profile.avatar, authorBio: profile.bio, image: "",
    look: "", caption: "", tags: "", style: "", likes: 0, likedBy: [], privacy: "public", garmentIds: [], comments: [], createdAt: Date.now(),
  });
  const [tagged, setTagged] = useState<string[]>(initial?.garmentIds || []);
  const [styleTags, setStyleTags] = useState((initial?.tags || "").split(" · ").filter(Boolean));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const share = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const taggedPieces: CommunityGarment[] = garments
        .filter((garment) => tagged.includes(String(garment.id)))
        .map(({ id, name, type, color, material, style, occasion }) => ({ id: String(id), name, type, color, material, style, occasion }));
      await onSave({ ...draft, ownerId: userId, name: profile.displayName, handle: profile.username, avatar: profile.avatar, authorBio: profile.bio, garmentIds: tagged, taggedPieces, tags: styleTags.join(" · ") });
      onClose();
    } catch (error) {
      console.error("Could not save community post", error);
      setSaveError(isFirestorePermissionDenied(error)
        ? lang === "th"
          ? "กฎ Firestore ปฏิเสธการบันทึกโพสต์ โปรดอนุญาตให้ผู้ใช้ที่เข้าสู่ระบบสร้างโพสต์ของตนเอง"
          : "Firestore rules denied this post. Allow signed-in users to create their own communityPosts."
        : lang === "th" ? "แชร์โพสต์ไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not share your post. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet post-composer" onClick={(event) => event.stopPropagation()}>
        <div className="composer-head"><button className="close-button" onClick={onClose}><X size={20} /></button><strong>{initial ? (lang === "th" ? "แก้ไขโพสต์" : "Edit post") : (lang === "th" ? "สร้างโพสต์" : "Create post")}</strong><span /></div>
        <div className="composer-user"><span className="post-avatar">{draft.name.slice(0, 1)}</span><div><strong>{draft.name}</strong><select value={draft.privacy} onChange={(event) => setDraft({ ...draft, privacy: event.target.value as "public" | "private" })}><option value="public">{lang === "th" ? "ชุมชน" : "Community"}</option><option value="private">{lang === "th" ? "ส่วนตัว" : "Only me"}</option></select></div></div>
        <textarea className="caption-input" value={draft.caption} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} placeholder={lang === "th" ? "เล่าเรื่องราวของลุคนี้..." : "Tell the story of this look..."} />
        <label className="post-photo-input">
          <input type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              if (typeof result !== "string") {
                setSaveError(lang === "th" ? "อ่านรูปภาพไม่สำเร็จ โปรดลองเลือกรูปอื่น" : "Could not read that photo. Please choose another.");
                return;
              }
              setDraft((current) => ({ ...current, image: result }));
              setSaveError("");
            };
            reader.onerror = () => setSaveError(lang === "th" ? "อ่านรูปภาพไม่สำเร็จ โปรดลองเลือกรูปอื่น" : "Could not read that photo. Please choose another.");
            reader.readAsDataURL(file);
          }} />
          {draft.image ? <img src={draft.image} alt="Post preview" /> : <div className="post-photo-placeholder"><ImagePlus size={24} /><span>{lang === "th" ? "อัปโหลดรูปภาพ" : "Upload photos"}</span></div>}<span><ImagePlus size={18} /> {draft.image ? (lang === "th" ? "เปลี่ยนรูป" : "Change photo") : (lang === "th" ? "อัปโหลดรูปภาพ" : "Upload photos")}</span>
        </label>
        <div className="composer-fields">
          <input value={draft.look} onChange={(event) => setDraft({ ...draft, look: event.target.value })} placeholder={lang === "th" ? "ตั้งชื่อลุค" : "Name this look"} />
          <select aria-label={lang === "th" ? "สไตล์แฟชั่น" : "Fashion style"} value={draft.style || ""} onChange={(event) => setDraft({ ...draft, style: event.target.value })}>
            <option value="">{lang === "th" ? "เลือกสไตล์" : "Choose a style"}</option>
            {FASHION_STYLES.map((style) => <option key={style}>{style}</option>)}
          </select>
        </div>
        <div className="composer-tags"><TagDropdown label={lang === "th" ? "แท็กแฟชั่น" : "Fashion tags"} emptyLabel={lang === "th" ? "เลือกแท็ก" : "Choose tags"} options={FASHION_TAGS} selected={styleTags} onChange={setStyleTags} /></div>
        <div className="tag-closet">
          <span><Tag size={16} /> {lang === "th" ? "แท็กเสื้อผ้าจากตู้" : "Tag pieces from your closet"}</span>
          <div>{garments.map((garment) => <button className={tagged.includes(String(garment.id)) ? "selected" : ""} onClick={() => setTagged((items) => items.includes(String(garment.id)) ? items.filter((id) => id !== String(garment.id)) : [...items, String(garment.id)])} key={garment.id}><img src={garment.image} alt="" /><small>{garmentName(garment, lang)}</small>{tagged.includes(String(garment.id)) && <Check size={13} />}</button>)}</div>
        </div>
        {saveError && <p className="post-save-error" role="alert">{saveError}</p>}
        <div className="composer-footer">
          <button className="primary-button" disabled={saving || !draft.image || !draft.look.trim() || !draft.caption.trim()} onClick={share}>
            {saving ? (lang === "th" ? "กำลังโพสต์..." : "Posting...") : (initial ? (lang === "th" ? "บันทึกโพสต์" : "Save post") : (lang === "th" ? "โพสต์" : "Post"))}
          </button>
        </div>
      </article>
    </div>
  );
}

function PostDetailSheet({
  post,
  garments,
  onClose,
  onProfile,
  onEdit,
  onComment,
  onLike,
  onShare,
  canEdit,
  isLiked,
}: {
  post: FashionPost;
  garments: Garment[];
  onClose: () => void;
  onProfile: () => void;
  onEdit: () => void;
  onComment: (comment: string) => Promise<void>;
  onLike: () => void;
  onShare: () => void;
  canEdit: boolean;
  isLiked: boolean;
}) {
  const { lang } = useLanguage();
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const taggedGarments: CommunityGarment[] = post.taggedPieces ?? (canEdit ? garments
    .filter((garment) => post.garmentIds.includes(String(garment.id)))
    .map(({ id, name, type, color, material, style, occasion }) => ({ id: String(id), name, type, color, material, style, occasion })) : []);
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet post-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <img src={post.image} alt={post.look} />
        <div className="post-detail-side">
          <div className="post-detail-user"><button onClick={onProfile} className="post-avatar">{post.avatar ? <img src={post.avatar} alt="" /> : post.name.slice(0, 1)}</button><button onClick={onProfile}><strong>{post.name}</strong><small>{post.handle}</small></button>{canEdit && <button className="icon-button" onClick={onEdit}><Pencil size={17} /></button>}<button className="close-button" onClick={onClose}><X size={19} /></button></div>
          <div className="post-copy"><h2>{post.look}</h2><p>{post.caption}</p><span>{[post.style, post.tags].filter(Boolean).join(" · ")}</span></div>
          <div className="post-tagged-pieces">
            <strong><Tag size={14} /> {lang === "th" ? "เสื้อผ้าในลุคนี้" : "Pieces in this look"}</strong>
            <div>{taggedGarments.length ? taggedGarments.map((garment) => <span key={garment.id}><small>{garmentName(garment, lang)}</small>{[garment.type, garment.color, garment.material, garment.style].filter(Boolean).join(" · ") && <small>{[garment.type, garment.color, garment.material, garment.style].filter(Boolean).join(" · ")}</small>}</span>) : <p>{lang === "th" ? "ไม่ได้แท็กเสื้อผ้า" : "No clothing tagged."}</p>}</div>
          </div>
          <div className="comments">{post.comments.map((item) => <p key={item.id}><strong>{item.name}</strong> {item.text}</p>)}</div>
          <div className="post-detail-actions"><button aria-label={isLiked ? "Remove like" : "Like post"} onClick={onLike}><Heart size={21} fill={isLiked ? "currentColor" : "none"} /></button><button aria-label={lang === "th" ? "เขียนความคิดเห็น" : "Write a comment"} onClick={() => document.getElementById("post-comment-input")?.focus()}><MessageCircle size={21} /></button><button aria-label={lang === "th" ? "ส่งโพสต์ให้เพื่อน" : "Send post to a friend"} onClick={onShare}><Send size={21} /></button><strong>{post.likedBy?.length ?? post.likes} {lang === "th" ? "ถูกใจ" : "likes"} · {post.comments?.length ?? 0} {lang === "th" ? "ความคิดเห็น" : "comments"}</strong></div>
          <div className="comment-box"><input id="post-comment-input" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={lang === "th" ? "เพิ่มความคิดเห็น..." : "Add a comment..."} /><button onClick={async () => { const text = comment.trim(); if (!text) return; try { await onComment(text); setComment(""); setCommentError(""); } catch { setCommentError(lang === "th" ? "ส่งความคิดเห็นไม่สำเร็จ" : "Could not post comment."); } }}>{lang === "th" ? "โพสต์" : "Post"}</button>{commentError && <small role="alert">{commentError}</small>}</div>
        </div>
      </article>
    </div>
  );
}

function SendPostSheet({ post, userId, senderName, onClose, onSent }: { post: FashionPost; userId: string; senderName: string; onClose: () => void; onSent: (friend: CommunityFriend) => void }) {
  const { lang } = useLanguage();
  const { friends, error: friendsError } = useCommunityInbox(userId);
  const [sendingTo, setSendingTo] = useState("");
  const [error, setError] = useState("");
  const sendPost = async (friend: CommunityFriend) => {
    setSendingTo(friend.uid);
    setError("");
    try {
      await sendCommunityMessage(friend.chatId, {
        senderId: userId,
        recipientId: friend.uid,
        senderName,
        text: "",
        createdAt: Date.now(),
        readBy: [userId],
        sharedPost: { id: post.id, ownerId: post.ownerId || userId, ownerName: post.name, look: post.look, image: post.image },
      });
      onSent(friend);
    } catch (sendError) {
      console.error("Could not share community post in chat", sendError);
      setError(lang === "th" ? "ส่งโพสต์ไม่สำเร็จ ตรวจสอบกฎ Firestore ของแชต" : "Could not send post. Check the Firestore chat rules.");
    } finally {
      setSendingTo("");
    }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet share-post-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "แชร์ในแชต" : "Share in chat"}</span><h2>{lang === "th" ? "ส่งโพสต์ให้เพื่อน" : "Send post to a friend"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="share-post-preview"><img src={post.image} alt="" /><span><strong>{post.look}</strong><small>{post.name}</small></span></div>
        {friendsError && <p className="feed-error" role="alert">{friendsError}</p>}
        {!friends.length && <p className="feed-empty">{lang === "th" ? "ยังไม่มีเพื่อนให้ส่งโพสต์ ต้องเป็นเพื่อนกันก่อน" : "No friends to share with yet. You need to be friends first."}</p>}
        <div className="share-friend-list">{friends.map((friend) => <button key={friend.uid} disabled={Boolean(sendingTo)} onClick={() => void sendPost(friend)}>
          <span className="post-avatar">{friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1)}</span><strong>{friend.name}</strong>
          {sendingTo === friend.uid ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
        </button>)}</div>
        {error && <p className="feed-error" role="alert">{error}</p>}
      </article>
    </div>
  );
}

function FeedView({ garments, profile, userId, bonusAvailable, onPosted }: { garments: Garment[]; profile: Profile; userId: string; bonusAvailable: boolean; onPosted: () => void }) {
  const { lang, t } = useLanguage();
  const [feedPosts, setFeedPosts] = useState<FashionPost[]>([]);
  const [composer, setComposer] = useState<FashionPost | "new" | null>(null);
  const [selected, setSelected] = useState<FashionPost | null>(null);
  const [viewedProfile, setViewedProfile] = useState<FashionPost | null>(null);
  const [sharingPost, setSharingPost] = useState<FashionPost | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [query, setQuery] = useState("");
  const [bonusNote, setBonusNote] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState("");
  useEffect(() => subscribeCommunityPosts(
    (posts) => {
      setFeedPosts(posts.filter((post) => post.privacy === "public" && Boolean(post.ownerId && post.name && post.image && post.look)).map((post) => ({
        ...post,
        garmentIds: post.garmentIds ?? [],
        likedBy: post.likedBy ?? [],
        likes: post.likedBy?.length ?? post.likes ?? 0,
        comments: post.comments ?? [],
      })));
      setLoadingFeed(false);
      setFeedError("");
    },
    (error) => {
      console.error("Could not load community posts", error);
      setLoadingFeed(false);
      setFeedError(isFirestorePermissionDenied(error)
        ? lang === "th"
          ? "กฎ Firestore ปฏิเสธการเข้าถึง: อนุญาตให้อ่านโพสต์สาธารณะใน communityPosts"
          : "Firestore rules denied access. Allow signed-in users to read public communityPosts."
        : lang === "th" ? "โหลดโพสต์ชุมชนไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not load community posts. Please try again.");
    },
  ), [lang]);
  useEffect(() => {
    if (!selected) return;
    const updated = feedPosts.find((post) => post.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  }, [feedPosts, selected]);
  const savePost = async (post: FashionPost) => {
    const before = feedPosts.find((item) => item.id === post.id);
    await saveCommunityPost(userId, post);
    setFeedError("");
    if (post.privacy === "public" && (!before || before.privacy !== "public")) {
      if (bonusAvailable) {
        setBonusNote(true);
        setTimeout(() => setBonusNote(false), 4000);
      }
      onPosted();
    }
  };
  const addComment = async (comment: string) => {
    try {
      if (!selected) throw new Error("No community post is selected.");
      const newComment: CommunityComment = {
        id: createCommunityId(),
        ownerId: userId,
        name: profile.displayName,
        text: comment,
        createdAt: Date.now(),
      };
      await addCommunityComment(selected.id, newComment);
      setFeedError("");
    } catch (error) {
      console.error("Could not add community comment", error);
      setFeedError(isFirestorePermissionDenied(error)
        ? lang === "th"
          ? "กฎ Firestore ปฏิเสธการแสดงความคิดเห็น: อนุญาตให้ผู้ใช้ที่เข้าสู่ระบบแสดงความคิดเห็นในโพสต์สาธารณะ"
          : "Firestore rules denied this comment. Allow signed-in users to comment on public posts."
        : lang === "th" ? "ส่งความคิดเห็นไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not post your comment. Please try again.");
      throw error;
    }
  };
  const toggleLike = async (post: FashionPost) => {
    const liked = post.likedBy?.includes(userId) ?? false;
    try {
      await toggleCommunityLike(post.id, userId, liked);
    } catch (error) {
      console.error("Could not update community like", error);
      setFeedError(isFirestorePermissionDenied(error)
        ? lang === "th"
          ? "กฎ Firestore ปฏิเสธการถูกใจ: อนุญาตให้ผู้ใช้ที่เข้าสู่ระบบอัปเดตการถูกใจโพสต์สาธารณะ"
          : "Firestore rules denied this appreciation. Allow signed-in users to update likes on public posts."
        : lang === "th" ? "อัปเดตการถูกใจไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not update your appreciation. Please try again.");
    }
  };
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).map((term) => term.replace(/^#/, "")).filter(Boolean);
  const visiblePosts = feedPosts.filter((post) => {
    if (post.privacy !== "public") return false;
    if (!searchTerms.length) return true;
    const taggedDetails = post.ownerId === userId ? garments
      .filter((garment) => post.garmentIds.includes(String(garment.id)))
      .flatMap((garment) => [garment.name, garment.type, garment.color, garment.material, garment.style, garment.occasion]) : [];
    const sharedDetails = (post.taggedPieces ?? []).flatMap((garment) => [garment.name, garment.type, garment.color, garment.material, garment.style, garment.occasion]);
    const searchableText = [post.name, post.handle, post.look, post.caption, post.tags, post.style, ...taggedDetails, ...sharedDetails]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return searchTerms.every((term) => searchableText.includes(term));
  });
  return (
    <div className="feed-grid">
      <section className="share-prompt" data-tour="share-look">
        <div><span className="eyebrow">{bonusNote ? (lang === "th" ? "ได้รับ +3 คะแนนแล้ว!" : "+3 points added!") : bonusAvailable ? (lang === "th" ? "โพสต์วันนี้รับ +3 คะแนน (วันละครั้ง)" : "Post a look today for +3 pts (once a day)") : (lang === "th" ? "รับโบนัสโพสต์ของวันนี้แล้ว" : "Today’s post bonus is claimed")}</span><h2>{t.whatRewear}</h2></div>
        <button className="primary-button" onClick={() => setComposer("new")}><Camera size={18} /> {t.shareLook}</button>
      </section>
      <label className="search-field community-search" data-tour="community-search">
        <Search size={18} />
        <input aria-label={t.communitySearch} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.communitySearch} />
      </label>
      {feedError && <p className="feed-error" role="alert">{feedError}</p>}
      {visiblePosts.map((sourcePost) => {
        const post = sourcePost;
        const isLiked = post.likedBy?.includes(userId) ?? false;
        return (
        <article className="post-card" key={post.id}>
          <div className="post-user">
            <button className="post-avatar" onClick={() => setViewedProfile(post)}>{post.avatar ? <img src={post.avatar} alt="" /> : post.name.slice(0, 1)}</button>
            <button className="post-user-copy" onClick={() => setViewedProfile(post)}><strong>{post.name}</strong><span>{post.handle}</span></button>
          </div>
          <button className="post-image-wrap" onClick={() => setSelected(post)}>
            <img src={post.image} alt={`${post.name}'s outfit`} />
            <span className="clothes-tag"><Tag size={13} /> {lang === "th" ? `เสื้อผ้า ${post.garmentIds.length} ชิ้น` : `${post.garmentIds.length} tagged pieces`}</span>
          </button>
          <div className="post-body">
            <div className="post-actions">
              <button aria-label={isLiked ? "Remove like" : "Like post"} onClick={() => void toggleLike(post)}><Heart size={20} fill={isLiked ? "currentColor" : "none"} /></button>
              <button aria-label={lang === "th" ? "ดูความคิดเห็น" : `View ${post.comments.length} comments`} onClick={() => setSelected(post)}><MessageCircle size={20} /></button>              <button aria-label={lang === "th" ? "แชร์โพสต์" : "Share post"} onClick={() => setSharingPost(post)}><Send size={20} /></button>
              <span>{post.likedBy?.length ?? post.likes} {lang === "th" ? "ถูกใจ" : "likes"} · {post.comments.length} {lang === "th" ? "ความคิดเห็น" : "comments"}</span>
            </div>
            <button className="post-title" onClick={() => setSelected(post)}><h3>{post.look}</h3><p>{[post.style, post.tags].filter(Boolean).join(" · ")}</p></button>
          </div>
        </article>
      )})}
      {!feedError && loadingFeed && <p className="feed-empty">{lang === "th" ? "กำลังโหลดโพสต์ชุมชน..." : "Loading community posts..."}</p>}
      {!feedError && !loadingFeed && !visiblePosts.length && <p className="feed-empty">{query.trim()
        ? (lang === "th" ? "ไม่พบโพสต์ที่ตรงกัน ลองค้นหาชื่อเสื้อผ้าหรือแท็กสไตล์อื่น" : "No posts match that search. Try another clothing item or style tag.")
        : (lang === "th" ? "ยังไม่มีโพสต์" : "No posts yet.")}</p>}
      {shareNotice && <p className="feed-success" role="status">{shareNotice}</p>}
      {composer && <PostComposer garments={garments} profile={profile} userId={userId} initial={composer === "new" ? undefined : composer} onClose={() => setComposer(null)} onSave={savePost} />}
      {selected && <PostDetailSheet post={selected} garments={garments} canEdit={selected.ownerId === userId} isLiked={selected.likedBy?.includes(userId) ?? false} onLike={() => void toggleLike(selected)} onShare={() => setSharingPost(selected)} onClose={() => setSelected(null)} onProfile={() => setViewedProfile(selected)} onEdit={() => setComposer(selected)} onComment={addComment} />}
      {sharingPost && <SendPostSheet post={sharingPost} userId={userId} senderName={profile.displayName} onClose={() => setSharingPost(null)} onSent={(friend) => { setShareNotice(lang === "th" ? `ส่งโพสต์ให้ ${friend.name} แล้ว` : `Post sent to ${friend.name}.`); setTimeout(() => setShareNotice(""), 3500); setSharingPost(null); }} />}
      {viewedProfile && <CommunityProfileSheet profileId={viewedProfile.ownerId || ""} userId={userId} currentMember={{ name: profile.displayName, handle: profile.username, avatar: profile.avatar }} name={viewedProfile.name} handle={viewedProfile.handle} image={viewedProfile.avatar || ""} bio={viewedProfile.authorBio} onClose={() => setViewedProfile(null)} />}
    </div>
  );
}

function ListingComposer({ userId, profile, onClose, onSave }: { userId: string; profile: Profile; onClose: () => void; onSave: (listing: MarketplaceListing) => Promise<void> }) {
  const { lang } = useLanguage();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [material, setMaterial] = useState("");
  const [condition, setCondition] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    const amount = Number(price);
    if (!image || !name.trim() || !type || !size || !style || !condition || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: createCommunityId(),
        sellerId: userId,
        seller: profile.displayName,
        sellerHandle: profile.username,
        sellerAvatar: profile.avatar,
        name: name.trim(),
        type,
        size,
        price: amount,
        image,
        material: material.trim(),
        condition,
        description: description.trim(),
        style,
        tags,
        createdAt: Date.now(),
        sold: false,
      });
      onClose();
    } catch (saveError) {
      console.error("Could not create marketplace listing", saveError);
      setError(isFirestorePermissionDenied(saveError)
        ? lang === "th"
          ? "กฎ Firestore ปฏิเสธการลงขาย โปรดอนุญาตให้ผู้ใช้ที่เข้าสู่ระบบสร้างรายการของตนเอง"
          : "Firestore rules denied this listing. Allow signed-in users to create their own marketplaceListings."
        : lang === "th" ? "ลงขายไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not list this item. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet listing-composer" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "ขายให้สมาชิกในชุมชน" : "Sell to the community"}</span><h2>{lang === "th" ? "ลงขายเสื้อผ้า" : "List a clothing item"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <label className="listing-upload">
          <input type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setImage(String(reader.result));
            reader.readAsDataURL(file);
          }} />
          {image ? <img src={image} alt="Listing preview" /> : <span><Upload size={22} /> {lang === "th" ? "อัปโหลดรูปเสื้อผ้า" : "Upload clothing photos"}</span>}
        </label>
        <div className="listing-form">
          <label><span>{lang === "th" ? "ชื่อเสื้อผ้า" : "Item name"}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>{lang === "th" ? "ประเภท" : "Type"}</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">{lang === "th" ? "เลือกประเภท" : "Choose type"}</option>{CLOTHING_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>{lang === "th" ? "ขนาด" : "Size"}</span><select value={size} onChange={(event) => setSize(event.target.value)}><option value="">{lang === "th" ? "เลือกขนาด" : "Choose size"}</option>{SIZES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>{lang === "th" ? "ราคา (บาท)" : "Price (THB)"}</span><input type="number" min="1" step="1" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
          <label><span>{lang === "th" ? "วัสดุ" : "Material"}</span><input value={material} onChange={(event) => setMaterial(event.target.value)} /></label>
          <label><span>{lang === "th" ? "สภาพ" : "Condition"}</span><select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">{lang === "th" ? "เลือกสภาพ" : "Choose condition"}</option>{["New with tags", "Like new", "Very good", "Good", "Well loved"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>{lang === "th" ? "สไตล์" : "Style"}</span><select value={style} onChange={(event) => setStyle(event.target.value)}><option value="">{lang === "th" ? "เลือกสไตล์" : "Choose a style"}</option>{FASHION_STYLES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="wide"><span>{lang === "th" ? "รายละเอียด" : "Description"}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        </div>
        <TagDropdown label={lang === "th" ? "แท็กแฟชั่น" : "Fashion tags"} emptyLabel={lang === "th" ? "เลือกแท็ก" : "Choose tags"} options={FASHION_TAGS} selected={tags} onChange={setTags} />
        {error && <p className="post-save-error" role="alert">{error}</p>}
        <button className="primary-button full" disabled={saving || !image || !name.trim() || !type || !size || !style || !condition || !Number.isFinite(Number(price)) || Number(price) <= 0} onClick={() => void submit()}>{saving ? (lang === "th" ? "กำลังลงขาย..." : "Listing...") : (lang === "th" ? "ลงขายให้สมาชิก" : "List for sale")}</button>
      </article>
    </div>
  );
}

function DemoQrCode() {
  const cells = Array.from({ length: 441 }, (_, index) => {
    const x = index % 21;
    const y = Math.floor(index / 21);
    const finder = (left: number, top: number) => {
      const dx = x - left, dy = y - top;
      if (dx < 0 || dx > 6 || dy < 0 || dy > 6) return null;
      return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
    };
    const fixed = finder(0, 0) ?? finder(14, 0) ?? finder(0, 14);
    return fixed ?? ((x * 17 + y * 31 + x * y * 7) % 11 < 5);
  });
  return <svg className="demo-qr" viewBox="0 0 21 21" role="img" aria-label="Mock QR code preview">{cells.map((dark, index) => dark && <rect key={index} x={index % 21} y={Math.floor(index / 21)} width="1" height="1" />)}</svg>;
}

function ListingDetailSheet({ listing, userId, currentMember, onClose, onPurchase, onDelete }: {
  listing: MarketplaceListing;
  userId: string;
  currentMember: Pick<CommunityFriend, "name" | "handle" | "avatar">;
  onClose: () => void;
  onPurchase: (listing: MarketplaceListing, method: DemoPaymentMethod) => Promise<void>;
  onDelete: (listing: MarketplaceListing) => Promise<void>;
}) {
  const { lang } = useLanguage();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payment, setPayment] = useState<DemoPaymentMethod>("promptpay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sellerOpen, setSellerOpen] = useState(false);
  const isSeller = listing.sellerId === userId;
  const checkout = async () => {
    setBusy(true);
    setError("");
    try {
      await onPurchase(listing, payment);
      setCheckoutOpen(false);
      onClose();
    } catch (purchaseError) {
      console.error("Mock checkout failed", purchaseError);
      setError(isFirestorePermissionDenied(purchaseError)
        ? lang === "th"
          ? "กฎ Firestore ปฏิเสธคำสั่งซื้อจำลอง โปรดอนุญาตให้ผู้ซื้อสร้างคำสั่งซื้อและอัปเดตรายการสินค้า"
          : "Firestore rules denied this demo order. Allow buyers to create orders and update listing status."
        : lang === "th" ? "ชำระเงินจำลองไม่สำเร็จ สินค้าอาจถูกซื้อไปแล้ว" : "Mock checkout failed. The item may have been purchased already.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="overlay" onClick={onClose}>
        <article className="sheet listing-detail-sheet" onClick={(event) => event.stopPropagation()}>
          <button className="close-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
          <img src={listing.image} alt={listing.name} />
          <div className="listing-detail-content">
            <span className="eyebrow">{listing.condition} · {listing.type} · {listing.size}</span>
            <h2>{listing.name}</h2>
            <p>{listing.description || (lang === "th" ? "ผู้ขายยังไม่ได้เพิ่มรายละเอียด" : "No description provided.")}</p>
            <div className="listing-tags"><span>{listing.style}</span>{listing.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            {listing.material && <p>{lang === "th" ? "วัสดุ" : "Material"}: {listing.material}</p>}
            <button className="seller-line" onClick={() => setSellerOpen(true)}><span className="post-avatar">{listing.sellerAvatar ? <img src={listing.sellerAvatar} alt="" /> : listing.seller.slice(0, 1)}</span><span><strong>{listing.seller}</strong><small>{listing.sellerHandle}</small></span><ArrowRight size={17} /></button>
            <div className="purchase-row">
              <div><small>{lang === "th" ? "ราคามือสอง" : "Secondhand price"}</small><strong>฿{listing.price.toLocaleString()}</strong></div>
              {isSeller
                ? <button className="danger-button" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(listing); onClose(); } catch (deleteError) { console.error("Could not remove marketplace listing", deleteError); setError(lang === "th" ? "ลบรายการไม่สำเร็จ โปรดลองอีกครั้ง" : "Could not remove this listing. Please try again."); } finally { setBusy(false); } }}><Trash2 size={17} /> {lang === "th" ? "ลบรายการ" : "Remove listing"}</button>
                : <button className="primary-button" onClick={() => setCheckoutOpen(true)}><ShoppingBag size={17} /> {lang === "th" ? "ซื้อจากสมาชิก" : "Buy from member"}</button>}
            </div>
            {error && <p className="feed-error" role="alert">{error}</p>}
            <p className="mock-checkout-note">{lang === "th" ? "การชำระเงินและคำสั่งซื้อเป็นเพียงตัวอย่างจำลอง ไม่มีการโอนเงินจริง" : "Demo checkout only. No real payment will be made."}</p>
          </div>
        </article>
        {sellerOpen && <CommunityProfileSheet profileId={listing.sellerId} userId={userId} currentMember={currentMember} name={listing.seller} handle={listing.sellerHandle} image={listing.sellerAvatar || ""} onClose={() => setSellerOpen(false)} />}
      </div>
      {checkoutOpen && (
        <div className="overlay checkout-overlay" onClick={() => setCheckoutOpen(false)}>
          <article className="sheet checkout-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "ชำระเงินตัวอย่าง" : "Mock checkout"}</span><h2>{lang === "th" ? "เลือกวิธีชำระเงิน" : "Choose payment method"}</h2></div><button className="close-button" onClick={() => setCheckoutOpen(false)}><X size={20} /></button></div>
            <p className="mock-checkout-note">{lang === "th" ? "นี่คือขั้นตอนจำลอง ไม่มีการเรียกเก็บเงินจริง" : "This checkout is a demo. No money will be charged or transferred."}</p>
            <label className={`payment-choice ${payment === "promptpay" ? "selected" : ""}`}><input type="radio" name="demo-payment" checked={payment === "promptpay"} onChange={() => setPayment("promptpay")} /><span><strong>PromptPay</strong><small>{lang === "th" ? "จำลองการจ่ายผ่านพร้อมเพย์" : "Simulated PromptPay payment"}</small></span><span className="promptpay-mark">PromptPay</span></label>
            <label className={`payment-choice ${payment === "qr" ? "selected" : ""}`}><input type="radio" name="demo-payment" checked={payment === "qr"} onChange={() => setPayment("qr")} /><span><strong>{lang === "th" ? "สแกน QR" : "QR code"}</strong><small>{lang === "th" ? "ตัวอย่าง QR สำหรับหน้าตาชำระเงิน" : "Preview-only QR payment option"}</small></span></label>
            {payment === "qr" && <div className="qr-preview"><DemoQrCode /><small>{lang === "th" ? "ตัวอย่างเท่านั้น — ไม่สามารถใช้ชำระเงินจริง" : "Demo preview only — not a scannable payment code"}</small></div>}
            <div className="checkout-total"><span>{listing.name}</span><strong>฿{listing.price.toLocaleString()}</strong></div>
            <button className="primary-button full" disabled={busy} onClick={() => void checkout()}>{busy ? (lang === "th" ? "กำลังดำเนินการ..." : "Processing...") : (lang === "th" ? "ยืนยันการสั่งซื้อจำลอง" : "Confirm demo order")}</button>
          </article>
        </div>
      )}
    </>
  );
}

function MarketView({ profile, userId, onPurchase, onDelete, onCreate }: {
  profile: Profile;
  userId: string;
  onPurchase: (listing: MarketplaceListing, method: DemoPaymentMethod) => Promise<void>;
  onDelete: (listing: MarketplaceListing) => Promise<void>;
  onCreate: (listing: MarketplaceListing) => Promise<void>;
}) {
  const { lang, t } = useLanguage();
  const { listings, loading, error } = useMarketplaceListings(lang);
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleListings = listings.filter((listing) => {
    const text = [listing.name, listing.type, listing.size, listing.seller, listing.material, listing.style, ...listing.tags].join(" ").toLocaleLowerCase();
    return searchTerms.every((term) => text.includes(term));
  });
  return (
    <div className="market-grid">
      <section className="market-hero">
        <div><span className="eyebrow">Sustain-Second</span><h2>{lang === "th" ? <>เสื้อผ้าดี<br />เรื่องราวบทใหม่</> : <>Good pieces,<br />next chapters.</>}</h2><p>{lang === "th" ? "ซื้อและขายเสื้อผ้ามือสองระหว่างสมาชิก Reweave" : "Buy and sell pre-loved clothes directly with other Reweave members."}</p></div>
        <button className="primary-button sell-button" onClick={() => setComposerOpen(true)}><Plus size={18} /> {lang === "th" ? "ลงขายเสื้อผ้า" : "Sell an item"}</button>
      </section>
      <label className="search-field marketplace-search"><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.shopSearch} aria-label={t.shopSearch} /></label>
      {error && <p className="feed-error" role="alert">{error}</p>}
      {loading && <p className="feed-empty">{lang === "th" ? "กำลังโหลดรายการ..." : "Loading listings..."}</p>}
      {!loading && !error && !visibleListings.length && <p className="feed-empty">{query.trim()
        ? (lang === "th" ? "ไม่พบเสื้อผ้าที่ตรงกัน" : "No clothing matches that search.")
        : (lang === "th" ? "ยังไม่มีเสื้อผ้าลงขาย เป็นคนแรกที่ลงขายได้เลย" : "No member listings yet. Be the first to sell an item.")}</p>}
      {visibleListings.map((listing) => (
        <article className="listing-card" key={listing.id} role="button" tabIndex={0} onClick={() => setSelected(listing)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(listing); } }}>
          <img src={listing.image} alt={listing.name} />
          <span className="listing-size">{listing.size}</span>
          <div><small>{listing.seller} · {listing.style}</small><h3>{listing.name}</h3><strong>฿{listing.price.toLocaleString()}</strong><div className="listing-tags">{listing.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          <span className="listing-open-icon" aria-hidden="true"><ArrowRight size={18} /></span>
        </article>
      ))}
      {selected && <ListingDetailSheet listing={selected} userId={userId} currentMember={{ name: profile.displayName, handle: profile.username, avatar: profile.avatar }} onClose={() => setSelected(null)} onPurchase={onPurchase} onDelete={onDelete} />}
      {composerOpen && <ListingComposer userId={userId} profile={profile} onClose={() => setComposerOpen(false)} onSave={onCreate} />}
    </div>
  );
}

function ThreadComposer({ onClose, onPost }: { onClose: () => void; onPost: (thread: BoardThread) => void }) {
  const { lang } = useLanguage();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("Repair & care");
  const [body, setBody] = useState("");
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet thread-composer" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "แบ่งปันคำถาม" : "Share a question"}</span><h2>{lang === "th" ? "เริ่มกระทู้ใหม่" : "Start a thread"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="thread-form">
          <label><span>{lang === "th" ? "หัวข้อ" : "Title"}</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={lang === "th" ? "คุณอยากถามอะไร?" : "What would you like to ask?"} /></label>
          <label><span>{lang === "th" ? "หมวดหมู่" : "Topic"}</span><select value={topic} onChange={(event) => setTopic(event.target.value)}><option>Repair & care</option><option>Materials</option><option>Laundry</option><option>Textile awareness</option></select></label>
          <label><span>{lang === "th" ? "รายละเอียด" : "Details"}</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={lang === "th" ? "เพิ่มรายละเอียดเพื่อให้ชุมชนช่วยตอบได้ง่ายขึ้น..." : "Add context so the community can help..."} /></label>
        </div>
        <button className="primary-button full" disabled={!title.trim() || !body.trim()} onClick={() => { onPost({ id: String(Date.now()), title: title.trim(), topic, body: body.trim(), author: "Maya Chen", comments: [] }); onClose(); }}><Send size={17} /> {lang === "th" ? "โพสต์กระทู้" : "Post thread"}</button>
      </article>
    </div>
  );
}

function ThreadDetailSheet({ thread, onClose, onComment }: { thread: BoardThread; onClose: () => void; onComment: (comment: string) => void }) {
  const { lang } = useLanguage();
  const [comment, setComment] = useState("");
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet thread-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="thread-detail-head"><span className="eyebrow">{thread.topic}</span><h2>{thread.title}</h2><div><span className="thread-avatar">{thread.author.slice(0, 1)}</span><span><strong>{thread.author}</strong><small>{lang === "th" ? "โพสต์วันนี้" : "Posted today"}</small></span></div></div>
        <p className="thread-body">{thread.body}</p>
        <div className="thread-replies"><strong>{thread.comments.length} {lang === "th" ? "ความคิดเห็น" : "replies"}</strong>{thread.comments.map((item, index) => <article key={`${item}-${index}`}><span className="post-avatar">{index % 2 ? "A" : "N"}</span><p><strong>{index % 2 ? "Ari Bello" : "Noa Kim"}</strong>{item}</p></article>)}</div>
        <div className="thread-comment-box"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={lang === "th" ? "เขียนความคิดเห็น..." : "Write a helpful reply..."} /><button onClick={() => { if (comment.trim()) onComment(comment.trim()); setComment(""); }}><Send size={17} /></button></div>
        <button className="close-button thread-close" onClick={onClose}><X size={20} /></button>
      </article>
    </div>
  );
}

function BoardView() {
  const { lang } = useLanguage();
  const [threads, setThreads] = useState<BoardThread[]>([
    { id: "thread-1", title: lang === "th" ? "เสื้อไหมพรมหลวมแบบนี้ซ่อมได้ไหม?" : "Can this loose-knit sweater be repaired?", topic: "Repair & care", body: lang === "th" ? "มีห่วงไหมพรมหลุดบริเวณแขนเสื้อ อยากซ่อมโดยไม่ทำให้รอยเด่นเกินไป" : "A loop has pulled near the sleeve. I would love a repair method that stays subtle.", author: "Maya", comments: ["A crochet hook can pull the loop back through from the inside.", "A local visible mender could also turn it into a small detail."] },
    { id: "thread-2", title: lang === "th" ? "โพลีเอสเตอร์รีไซเคิลช่วยอะไรจริง ๆ?" : "What does recycled polyester actually change?", topic: "Materials", body: lang === "th" ? "กำลังพยายามเข้าใจข้อดีและข้อจำกัดก่อนเลือกซื้อ" : "I am trying to understand both the benefits and limitations before buying.", author: "Sora", comments: ["It reduces demand for virgin material, but microfiber shedding remains."] },
    { id: "thread-3", title: lang === "th" ? "วิธีล้างคราบน้ำมันบนผ้าลินิน" : "Best way to remove oil from linen?", topic: "Laundry", body: lang === "th" ? "อยากรักษาเนื้อผ้าและสีไว้โดยไม่ใช้น้ำยาที่แรงเกินไป" : "I want to preserve the texture and color without using something too harsh.", author: "Ari", comments: ["Try dish soap on the dry stain before a cool wash."] },
  ]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selected, setSelected] = useState<BoardThread | null>(null);
  return (
    <div className="board-list">
      <section className="board-banner"><div><span className="eyebrow">{lang === "th" ? "กระดานแลกเปลี่ยน" : "Exchange board"}</span><h2>{lang === "th" ? "ถาม เรียนรู้ และซ่อม" : "Ask, learn, repair."}</h2><p>{lang === "th" ? "พื้นที่สำหรับคำถามเรื่องสิ่งทอและคำตอบจากชุมชน" : "A thoughtful place for textile questions and shared solutions."}</p></div><button className="primary-button" onClick={() => setComposerOpen(true)}><Plus size={18} /> {lang === "th" ? "เริ่มกระทู้" : "Start a thread"}</button></section>
      {threads.map((thread) => (
        <button className="thread-card" key={thread.id} onClick={() => setSelected(thread)}><span className="thread-avatar">{thread.author.slice(0, 1)}</span><span><small>{thread.topic}</small><strong>{thread.title}</strong><em>{thread.comments.length} {lang === "th" ? "ความคิดเห็น · วันนี้" : "replies · active today"}</em></span><ArrowRight size={18} /></button>
      ))}
      {composerOpen && <ThreadComposer onClose={() => setComposerOpen(false)} onPost={(thread) => setThreads([thread, ...threads])} />}
      {selected && <ThreadDetailSheet thread={selected} onClose={() => setSelected(null)} onComment={(comment) => {
        setThreads((items) => items.map((thread) => thread.id === selected.id ? { ...thread, comments: [...thread.comments, comment] } : thread));
        setSelected((current) => current ? { ...current, comments: [...current.comments, comment] } : current);
      }} />}
    </div>
  );
}

function CommunityView({ state, userId, onPosted, onPurchase, onDeleteListing, onCreateListing }: {
  state: DemoState;
  userId: string;
  onPosted: () => void;
  onPurchase: (listing: MarketplaceListing, method: DemoPaymentMethod) => Promise<void>;
  onDeleteListing: (listing: MarketplaceListing) => Promise<void>;
  onCreateListing: (listing: MarketplaceListing) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<CommunityTab>("feed");
  return (
    <div className="page">
      <div className="segmented community-segments">
        <button data-tour="community-feed-tab" className={tab === "feed" ? "active" : ""} onClick={() => setTab("feed")}><Users size={17} /> {t.looks}</button>
        <button data-tour="community-market-tab" className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}><Store size={17} /> {t.shop}</button>
      </div>
      {tab === "feed"
        ? <FeedView garments={state.garments} profile={state.profile} userId={userId} bonusAvailable={state.postBonusOn !== TODAY} onPosted={onPosted} />
        : <MarketView profile={state.profile} userId={userId} onPurchase={onPurchase} onDelete={onDeleteListing} onCreate={onCreateListing} />}
    </div>
  );
}

function EditProfileSheet({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile;
  onClose: () => void;
  onSave: (profile: Partial<Profile>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet edit-profile-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">Account details</span><h2>Edit profile</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="avatar-editor">
          <div className="profile-avatar">{draft.avatar ? <img src={draft.avatar} alt="" /> : draft.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
          <label className="secondary-button file-button">
            {uploading ? <LoaderCircle className="spin" size={16} /> : <Camera size={16} />} {uploading ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const avatar = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () => reject(reader.error);
                  reader.readAsDataURL(file);
                });
                const small = await shrinkImage(avatar, 256);
                setDraft((current) => ({ ...current, avatar: small }));
                setUploading(false);
              }}
            />
          </label>
          <small>JPG, PNG, or WebP up to 6 MB.</small>
        </div>
        <div className="form-grid">
          {[
            ["displayName", "Display name"],
            ["username", "Username"],
            ["age", "Age"],
            ["location", "Location"],
          ].map(([key, label]) => (
            <label key={key}><span>{label}</span><input type={key === "age" ? "number" : "text"} value={String(draft[key as keyof Profile] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: key === "age" ? Number(event.target.value) : event.target.value })} /></label>
          ))}
          <label className="wide"><span>Bio</span><textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} /></label>
          <label><span>Default post visibility</span><select value={draft.privacy} onChange={(event) => setDraft({ ...draft, privacy: event.target.value })}><option value="private">Private</option><option value="public">Community</option></select></label>
          <label><span>Email</span><input value={draft.email} disabled /></label>
        </div>
        <button className="primary-button full" disabled={saving} onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); onClose(); }}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Save profile</button>
      </article>
    </div>
  );
}

function PrivacySheet({ profile, notifications, onClose, onSave, onSaveNotifications }: {
  profile: Profile;
  notifications: NotificationPreferences;
  onClose: () => void;
  onSave: (changes: Partial<Profile>) => Promise<void>;
  onSaveNotifications: (settings: NotificationPreferences) => void;
}) {
  const { lang } = useLanguage();
  const [visibility, setVisibility] = useState(profile.privacy);
  const [activity, setActivity] = useState(true);
  const [tags, setTags] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState(notifications);
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet settings-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "ควบคุมข้อมูลของคุณ" : "Control your space"}</span><h2>{lang === "th" ? "ความเป็นส่วนตัว" : "Privacy settings"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="privacy-options">
          <label><span><ShieldCheck size={19} /><span><strong>{lang === "th" ? "ผู้ชมเริ่มต้นของโพสต์" : "Default post audience"}</strong><small>{lang === "th" ? "เลือกผู้ที่เห็นโพสต์ใหม่" : "Choose who sees new posts"}</small></span></span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">{lang === "th" ? "เฉพาะฉัน" : "Only me"}</option><option value="public">{lang === "th" ? "ชุมชน" : "Community"}</option></select></label>
          <button onClick={() => setActivity(!activity)}><span>{activity ? <Eye size={19} /> : <EyeOff size={19} />}<span><strong>{lang === "th" ? "สถานะออนไลน์" : "Activity status"}</strong><small>{lang === "th" ? "ให้เพื่อนเห็นเมื่อคุณออนไลน์" : "Let friends see when you are active"}</small></span></span><span className={`toggle ${activity ? "on" : ""}`} /></button>
          <button onClick={() => setTags(!tags)}><span><Tag size={19} /><span><strong>{lang === "th" ? "อนุมัติแท็ก" : "Tag approval"}</strong><small>{lang === "th" ? "ตรวจสอบก่อนแสดงบนโปรไฟล์" : "Review tags before they appear"}</small></span></span><span className={`toggle ${tags ? "on" : ""}`} /></button>
        </div>
        <span className="eyebrow notification-settings-label">{lang === "th" ? "การแจ้งเตือน" : "Notifications"}</span>
        <div className="privacy-options notification-preferences">
          <button onClick={() => setNotificationSettings((current) => ({ ...current, dailyWater: !current.dailyWater }))}><span><Droplets size={19} /><span><strong>{lang === "th" ? "เตือนรดน้ำประจำวัน" : "Daily water reminder"}</strong><small>{lang === "th" ? "แจ้งเตือนหากยังไม่ได้รดน้ำต้นฝ้ายวันนี้" : "Remind me if I haven’t watered my cotton today"}</small></span></span><span className={`toggle ${notificationSettings.dailyWater ? "on" : ""}`} /></button>
          <button onClick={() => setNotificationSettings((current) => ({ ...current, friendPosts: !current.friendPosts }))}><span><Heart size={19} /><span><strong>{lang === "th" ? "โพสต์ใหม่จากเพื่อน" : "Friend posts"}</strong><small>{lang === "th" ? "แจ้งเมื่อเพื่อนแชร์ลุคใหม่" : "Show when a friend shares a new look"}</small></span></span><span className={`toggle ${notificationSettings.friendPosts ? "on" : ""}`} /></button>
          <button onClick={() => setNotificationSettings((current) => ({ ...current, friendListings: !current.friendListings }))}><span><ShoppingBag size={19} /><span><strong>{lang === "th" ? "สินค้าใหม่จากเพื่อน" : "Friend listings"}</strong><small>{lang === "th" ? "แจ้งเมื่อเพื่อนลงขายเสื้อผ้า" : "Show when a friend lists clothing for sale"}</small></span></span><span className={`toggle ${notificationSettings.friendListings ? "on" : ""}`} /></button>
        </div>
        <button className="primary-button full" onClick={async () => { await onSave({ privacy: visibility }); onSaveNotifications(notificationSettings); onClose(); }}><Check size={17} /> {lang === "th" ? "บันทึกการตั้งค่า" : "Save settings"}</button>
      </article>
    </div>
  );
}

function NotificationSheet({ waterDue, activities, error, onClose, onWater, onOpenCommunity }: {
  waterDue: boolean;
  activities: FriendActivityNotification[];
  error: string;
  onClose: () => void;
  onWater: () => void;
  onOpenCommunity: () => void;
}) {
  const { lang } = useLanguage();
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet notification-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <div><span className="eyebrow">{lang === "th" ? "อัปเดตจากชุมชน" : "Your updates"}</span><h2>{lang === "th" ? "การแจ้งเตือน" : "Notifications"}</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {waterDue && <article className="notification-item water-notification">
          <span className="notification-icon"><Droplets size={19} /></span>
          <div><strong>{lang === "th" ? "อย่าลืมรดน้ำต้นฝ้ายวันนี้" : "Your cotton needs water today"}</strong><small>{lang === "th" ? "รดน้ำวันนี้เพื่อดูแลต้นฝ้ายและรักษาสตรีค" : "Water today to care for your plant and keep your streak going."}</small></div>
          <button className="primary-button" onClick={onWater}>{lang === "th" ? "รดน้ำ" : "Water"}</button>
        </article>}
        {activities.map((item) => (
          <button className="notification-item activity-notification" key={item.id} onClick={onOpenCommunity}>
            {item.image ? <img src={item.image} alt="" /> : <span className="notification-icon">{item.type === "post" ? <Heart size={19} /> : <ShoppingBag size={19} />}</span>}
            <span><strong>{item.type === "post"
              ? (lang === "th" ? `${item.friendName} แชร์ลุคใหม่` : `${item.friendName} shared a new look`)
              : (lang === "th" ? `${item.friendName} ลงขายสินค้าใหม่` : `${item.friendName} listed a new item`)}</strong>
              <small>{item.title}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString(lang === "th" ? "th-TH" : "en")}` : ""}</small>
            </span>
            <ArrowRight size={17} />
          </button>
        ))}
        {!waterDue && !activities.length && !error && <p className="feed-empty">{lang === "th" ? "ยังไม่มีการแจ้งเตือนใหม่" : "You’re all caught up. No notifications right now."}</p>}
        {error && <p className="notification-error" role="alert">{error}</p>}
      </article>
    </div>
  );
}

function PointShopSheet({ points, onClose, onClaim }: { points: number; onClose: () => void; onClaim: (cost: number) => void }) {
  const { lang } = useLanguage();
  const [claimed, setClaimed] = useState<string[]>([]);
  const [tab, setTab] = useState<"shop" | "coupons">("shop");
  const [wallet, setWallet] = useState([
    { id: "welcome", title: lang === "th" ? "ส่วนลดร้านมือสอง 10%" : "10% off secondhand", code: "REWEAVE10", expires: "30 Sep 2026" },
  ]);
  const rewards = [
    ["repair", lang === "th" ? "ส่วนลดร้านซ่อม ฿200" : "$8 tailor discount", 600, "Repair"],
    ["wash", lang === "th" ? "ส่วนลดผลิตภัณฑ์ซักผ้า 15%" : "15% garment care", 850, "Care"],
    ["swap", lang === "th" ? "สิทธิ์เข้าร่วมงานแลกเสื้อผ้า" : "Clothing swap pass", 1100, "Community"],
  ] as const;
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet point-shop-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{points.toLocaleString()} {lang === "th" ? "คะแนนที่ใช้ได้" : "points available"}</span><h2>{lang === "th" ? "ร้านค้าคะแนน" : "Point shop"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="shop-tabs">
          <button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}><Gift size={16} /> {lang === "th" ? "แลกรางวัล" : "Rewards"}</button>
          <button className={tab === "coupons" ? "active" : ""} onClick={() => setTab("coupons")}><Tag size={16} /> {lang === "th" ? `คูปองของฉัน (${wallet.length})` : `My coupons (${wallet.length})`}</button>
        </div>
        {tab === "shop" ? (
          <div className="coupon-list">{rewards.map(([id, title, cost, category]) => <article className="coupon-card" key={id}><span className="coupon-icon"><Gift size={21} /></span><div><small>{category}</small><strong>{title}</strong><span>{cost} pts</span></div><button disabled={points < cost || claimed.includes(id)} onClick={() => { onClaim(cost); setClaimed([...claimed, id]); setWallet([...wallet, { id, title, code: `RW-${id.toUpperCase()}`, expires: "31 Dec 2026" }]); }}>{claimed.includes(id) ? <Check size={17} /> : (lang === "th" ? "แลก" : "Claim")}</button></article>)}</div>
        ) : (
          <div className="coupon-wallet">
            {wallet.map((coupon) => <article key={coupon.id}><div><small>{lang === "th" ? "คูปองพร้อมใช้" : "Available coupon"}</small><strong>{coupon.title}</strong><code>{coupon.code}</code></div><span><small>{lang === "th" ? "ใช้ได้ถึง" : "Expires"}</small><strong>{coupon.expires}</strong></span></article>)}
          </div>
        )}
      </article>
    </div>
  );
}

function FriendListSheet({ friends, unreadByChat, onClose, onSelect }: { friends: CommunityFriend[]; unreadByChat: Record<string, CommunityMessage[]>; onClose: () => void; onSelect: (friend: CommunityFriend) => void }) {
  const { lang } = useLanguage();
  const [search, setSearch] = useState("");
  const visibleFriends = friends.filter((friend) => `${friend.name} ${friend.handle}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return (
    <div className="overlay chat-overlay" onClick={onClose}>
      <article className="sheet friend-list-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header"><div><span className="eyebrow">{lang === "th" ? "ข้อความ" : "Messages"}</span><h2>{lang === "th" ? "เพื่อนของคุณ" : "Your friends"}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={lang === "th" ? "ค้นหาเพื่อน" : "Search friends"} /></label>
        {!friends.length && <p className="feed-empty">{lang === "th" ? "ยังไม่มีเพื่อน ยืนยันคำขอเป็นเพื่อนจากโปรไฟล์สมาชิกก่อน" : "No friends yet. Accept a friend request from a member profile to start chatting."}</p>}
        {!!friends.length && !visibleFriends.length && <p className="feed-empty">{lang === "th" ? "ไม่พบเพื่อน" : "No friends match that search."}</p>}
        <div className="friend-list">{visibleFriends.map((friend) => {
          const unread = unreadByChat[friend.chatId] ?? [];
          const latest = unread[unread.length - 1];
          return <button key={friend.uid} onClick={() => onSelect(friend)}>
            <span className="large-avatar">{friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1)}</span>
            <span><strong>{friend.name}</strong><small>{latest?.text || (lang === "th" ? "แตะเพื่อเปิดแชต" : "Tap to open chat")}</small></span>
            {unread.length > 0 && <i className="unread-count">{unread.length}</i>}
          </button>;
        })}</div>
      </article>
    </div>
  );
}

function ProfileView({
  state,
  userId,
  friends,
  unreadByChat,
  setState,
  onSaveProfile,
  notifications,
  onSaveNotifications,
  onChat,
  onFriendWater,
  onChatWithFriend,
}: {
  state: DemoState;
  userId: string;
  friends: CommunityFriend[];
  unreadByChat: Record<string, CommunityMessage[]>;
  setState: React.Dispatch<React.SetStateAction<DemoState>>;
  onSaveProfile: (profile: Partial<Profile>) => Promise<void>;
  notifications: NotificationPreferences;
  onSaveNotifications: (settings: NotificationPreferences) => void;
  onChat: () => void;
  onFriendWater: (friend: CommunityFriend) => Promise<void>;
  onChatWithFriend: (friend: CommunityFriend) => void;
}) {
  const { lang, t } = useLanguage();
  const [shop, setShop] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const initials = state.profile.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return (
    <div className="page profile-page">
      <section className="profile-hero">
        <div className="profile-avatar">{state.profile.avatar ? <img src={state.profile.avatar} alt={state.profile.displayName} /> : initials}<span><Check size={12} /></span></div>
        <div><span className="eyebrow">{state.profile.verified ? "Verified member" : "Member"}</span><h2>{state.profile.displayName}</h2><p>{state.profile.username} · {state.profile.location}</p></div>
        <button className="secondary-button" data-tour="edit-profile" onClick={() => setEditing(true)}><Settings size={17} /> {t.editProfile}</button>
      </section>
      <section className="impact-card">
        <div><span className="eyebrow">Your circular impact</span><h2>{state.points.toLocaleString()} <small>points</small></h2><p>{lang === "th" ? "ทุกวันที่ดูแลช่วยให้เสื้อผ้าถูกใช้งานต่อ" : "Every cared-for day keeps textiles in use."}</p></div>
        <div className="impact-stats"><span><strong>{state.plant.caredDays}</strong> cared days</span><span><strong>{state.garments.reduce((sum, garment) => sum + (garment.wearCount || 0), 0)}</strong> rewears</span><span><strong>{state.plant.streak}</strong> day streak</span></div>
      </section>
      <div className="profile-columns">
        <section className="menu-card" data-tour="profile-menu">
          <button onClick={() => setShop(true)}><span className="menu-icon"><ShoppingBag size={18} /></span><span><strong>{t.pointShop}</strong><small>{t.coupons}</small></span><ArrowRight size={18} /></button>
          <button onClick={onChat}><span className="menu-icon"><Users size={18} /></span><span><strong>{t.friends}</strong><small>{Object.values(unreadByChat).reduce((sum, messages) => sum + messages.length, 0)} {lang === "th" ? "ข้อความยังไม่อ่าน" : "unread messages"}</small></span><ArrowRight size={18} /></button>
          <button onClick={() => setPrivacyOpen(true)}><span className="menu-icon"><Lock size={18} /></span><span><strong>{lang === "th" ? "ความเป็นส่วนตัวและการแจ้งเตือน" : "Privacy & notifications"}</strong><small>{lang === "th" ? "จัดการผู้ชมโพสต์และประเภทการแจ้งเตือน" : "Choose post visibility and notification types"}</small></span><ArrowRight size={18} /></button>
          <button onClick={() => setState((current) => ({ ...current, dark: !current.dark }))}><span className="menu-icon">{state.dark ? <Moon size={18} /> : <Sun size={18} />}</span><span><strong>Appearance</strong><small>{state.dark ? "Dark mode" : "Light mode"}</small></span><ChevronDown size={18} /></button>
        </section>
        <section className="friend-card" data-tour="friend-card">
          <span className="eyebrow">Friends’ gardens</span>
          <h3>A little help travels.</h3>
          {!friends.length && <p className="friend-empty">{lang === "th" ? "เพิ่มเพื่อนเพื่อช่วยดูแลต้นฝ้ายและเริ่มแชต" : "Add friends to help with their cotton and start a chat."}</p>}
          {friends.map((friend) => {
            const helpedToday = friend.waterHelpBy?.[userId] === TODAY;
            const unread = unreadByChat[friend.chatId] ?? [];
            return <div className="friend-row friend-row-expanded" key={friend.uid}>
              <span className="friend-avatar">{friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1)}</span>
              <div><strong>{friend.name}’s cotton</strong><small>{helpedToday ? (lang === "th" ? "ช่วยวันนี้แล้ว" : "Helped today") : (lang === "th" ? "ต้องการน้ำวันนี้" : "Needs water today")}</small>
                {helpedToday && unread.map((message) => <button className="unread-message" key={message.id} onClick={() => onChatWithFriend(friend)}><span>{message.sharedPost ? `${lang === "th" ? "แชร์โพสต์: " : "Shared post: "}${message.sharedPost.look}` : message.text}</span><i>{lang === "th" ? "ยังไม่อ่าน" : "Unread"}</i></button>)}
                {helpedToday && !unread.length && <small>{lang === "th" ? "ไม่มีข้อความใหม่" : "No unread messages"}</small>}
              </div>
              {!helpedToday && <button onClick={() => void onFriendWater(friend)}><Droplets size={16} /> {lang === "th" ? "ช่วยรดน้ำ" : "Help water"}</button>}
            </div>;
          })}
        </section>
      </div>
      {shop && <PointShopSheet points={state.points} onClose={() => setShop(false)} onClaim={(cost) => setState((current) => ({ ...current, points: current.points - cost, profile: { ...current.profile, points: current.profile.points - cost } }))} />}
      {privacyOpen && <PrivacySheet profile={state.profile} notifications={notifications} onClose={() => setPrivacyOpen(false)} onSave={onSaveProfile} onSaveNotifications={onSaveNotifications} />}
      {editing && <EditProfileSheet profile={state.profile} onClose={() => setEditing(false)} onSave={onSaveProfile} />}
    </div>
  );
}

function ChatSheet({
  friend,
  userId,
  userName,
  onClose,
}: {
  friend: CommunityFriend;
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeCommunityMessages(friend.chatId, (items) => {
    setMessages(items);
    void markCommunityMessagesRead(friend.chatId, userId, items).catch((readError) => {
      console.error("Could not mark community messages read", readError);
      setError(lang === "th" ? "ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ" : "Could not mark messages as read.");
    });
  }, (loadError) => {
    console.error("Could not load community chat", loadError);
    setError(lang === "th" ? "โหลดแชตไม่สำเร็จ ตรวจสอบกฎ Firestore ของแชต" : "Could not load chat. Check the Firestore chat rules.");
  }), [friend.chatId, lang, userId]);

  const sendMessage = async () => {
    const messageText = text.trim();
    if (!messageText || sending) return;
    setSending(true);
    setError("");
    try {
      await sendCommunityMessage(friend.chatId, {
        senderId: userId,
        recipientId: friend.uid,
        senderName: userName,
        text: messageText,
        createdAt: Date.now(),
        readBy: [userId],
      });
      setText("");
    } catch (sendError) {
      console.error("Could not send community message", sendError);
      setError(lang === "th" ? "ส่งข้อความไม่สำเร็จ ตรวจสอบกฎ Firestore ของแชต" : "Could not send message. Check the Firestore chat rules.");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="overlay chat-overlay" onClick={onClose}>
      <article className="sheet chat-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="chat-header">
          <button className="close-button" onClick={onClose}><ArrowLeft size={20} /></button>
          <span className="post-avatar">{friend.avatar ? <img src={friend.avatar} alt="" /> : friend.name.slice(0, 1)}</span>
          <div><strong>{friend.name}</strong><small>{friend.handle}</small></div>
          <button className="icon-button"><MoreHorizontal size={19} /></button>
        </div>
        <div className="message-list">
          {!messages.length && <p className="feed-empty">{lang === "th" ? "เริ่มบทสนทนาได้เลย" : "Start the conversation."}</p>}
          {messages.map((message) => (
            <div className={`message ${message.senderId === userId ? "mine" : ""}`} key={message.id}>
              {message.sharedPost && <div className="shared-post-message"><img src={message.sharedPost.image} alt="" /><span><small>{lang === "th" ? "โพสต์ที่แชร์" : "Shared community post"}</small><strong>{message.sharedPost.look}</strong><em>{message.sharedPost.ownerName}</em></span></div>}
              {message.text && <p>{message.text}</p>}
              <small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
            </div>
          ))}
        </div>
        {error && <p className="chat-error" role="alert">{error}</p>}
        <div className="message-compose">
          <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void sendMessage()} placeholder={lang === "th" ? `ส่งข้อความถึง ${friend.name}...` : `Message ${friend.name}...`} />
          <button className="send-button" disabled={sending} onClick={sendMessage}>{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button>
        </div>
      </article>
    </div>
  );
}

function BottomNav({ tab, setTab }: { tab: MainTab; setTab: (tab: MainTab) => void }) {
  const { t } = useLanguage();
  const items: { id: MainTab; label: string; icon: typeof Sprout }[] = [
    { id: "plant", label: t.plant, icon: Sprout },
    { id: "closet", label: t.closet, icon: Shirt },
    { id: "community", label: t.community, icon: Users },
    { id: "profile", label: t.profile, icon: CircleUserRound },
  ];
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon size={21} /><span>{item.label}</span></button>;
      })}
    </nav>
  );
}

/** Testing helpers. Only rendered by `pnpm dev` (import.meta.env.DEV), never in a production build. */
function DevPanel({ setState }: { setState: React.Dispatch<React.SetStateAction<DemoState>> }) {
  const [days, setDays] = useState(31);
  const setCaredDays = (n: number) => setState((current) => {
    const reached = plantStage(n) >= 4;
    const grant = reached && !current.plant.creditGranted;
    return {
      ...current,
      profile: { ...current.profile, buyingCredits: current.profile.buyingCredits + (grant ? 1 : 0) },
      plant: { ...current.plant, alive: true, caredDays: n, streak: n > 0 ? Math.max(1, current.plant.streak) : 0, lastWatered: n > 0 ? TODAY : null, plantedOn: TODAY, creditGranted: reached },
    };
  });
  const button = { padding: "4px 8px", fontSize: 12 } as const;
  return (
    <details style={{ position: "fixed", top: 8, right: 8, zIndex: 9999, background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 12, padding: "6px 10px", fontSize: 12, boxShadow: "var(--shadow-soft)" }}>
      <summary style={{ cursor: "pointer" }}>Dev tools</summary>
      <div style={{ display: "grid", gap: 6, marginTop: 8, minWidth: 190 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Days cared
          <input type="number" min={0} max={200} value={days} onChange={(event) => setDays(Number(event.target.value))} style={{ width: 54 }} />
          <button className="secondary-button" style={button} onClick={() => setCaredDays(days)}>Set</button>
        </label>
        <button className="secondary-button" style={button} onClick={() => setState((c) => ({ ...c, points: c.points + 100, profile: { ...c.profile, points: c.profile.points + 100 } }))}>+100 points</button>
        <button className="secondary-button" style={button} onClick={() => setState((c) => ({ ...c, profile: { ...c.profile, buyingCredits: c.profile.buyingCredits + 1 } }))}>+1 buying credit</button>
        <button className="secondary-button" style={button} onClick={() => setState((c) => ({ ...c, plant: { ...c.plant, alive: false, streak: 0 } }))}>Kill plant</button>
        <button className="secondary-button" style={button} onClick={() => setState((c) => ({ ...c, wateredOn: null, postBonusOn: null }))}>Reset today’s water + post bonus</button>
        <button className="secondary-button" style={button} onClick={() => setState((c) => ({ ...c, plant: freshPlant(TODAY), wateredOn: null, points: 0, profile: { ...c.profile, points: 0, buyingCredits: 0 } }))}>Reset plant, points, credits</button>
      </div>
    </details>
  );
}

export default function App() {
  const [tab, setTab] = useState<MainTab>("plant");
  const { user, logout } = useAuth();
  const [state, setState] = useState<DemoState>(initialState);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState<CommunityFriend | null>(null);
  const { friends, unreadByChat, error: inboxError } = useCommunityInbox(user.uid);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem(`reweave-notifications-${user.uid}`);
      return saved ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_NOTIFICATION_PREFERENCES;
    } catch {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  });
  const { activities, error: notificationError } = useFriendActivityNotifications(friends, notificationPreferences);
  const waterReminderDue = notificationPreferences.dailyWater && state.plant.alive && state.wateredOn !== TODAY;
  const notificationCount = Number(waterReminderDue) + activities.length;
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("reweave-language") as Lang) || "en");
  const t = copy[lang];

  // Load this user's data from Firestore once after login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = loadState(user.uid); // cache for parts not yet moved to Firestore (garments and listings)
      let remote: Record<string, any> | null = null;
      try {
        remote = await loadUser(user.uid);
      } catch (error) {
        console.error("Could not load user data", error);
      }
      // closet pieces live in users/{uid}/garments. Older versions kept them only in this browser: move the user's own ones up once.
      let garments: Garment[] = [];
      try {
        garments = await loadGarments<Garment>(user.uid);
        const mine = (local.garments ?? []).filter((garment) => !OLD_DEMO_GARMENT_IDS.has(String(garment.id)));
        if (!garments.length && mine.length) {
          await Promise.all(mine.map((garment) => saveGarment(user.uid, garment as any)));
          garments = mine;
        }
      } catch (error) {
        console.error("Could not load garments", error);
        garments = (local.garments ?? []).filter((garment) => !OLD_DEMO_GARMENT_IDS.has(String(garment.id)));
      }
      let next: DemoState = { ...local, ...(remote ?? {}), garments };
      if (!remote) {
        // brand-new account: fresh profile + fresh plant (no demo numbers)
        const handle = (user.email ?? "user").split("@")[0];
        next = {
          ...next,
          wateredOn: null,
          points: 0,
          dark: false,
          plant: freshPlant(TODAY),
          profile: { ...initialState.profile, id: user.uid, email: user.email ?? "", displayName: user.displayName || handle, username: `@${handle}`, avatar: "", bio: "", age: 0, location: "", verified: false, points: 0, buyingCredits: 0 },
        };
      }
      next = {
        ...next,
        plant: checkPlant(next.plant, TODAY),
        closets: Array.from(new Set([DEFAULT_CLOSET, ...(Array.isArray(next.closets) ? next.closets : [])])),
      };
      if (!cancelled) {
        setState(next);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // first visit: show the guided tour once per account
  useEffect(() => {
    if (!ready) return;
    const key = `reweave-tour-seen-${user.uid}`;
    if (localStorage.getItem(key)) return;
    const timer = setTimeout(() => setTourOpen(true), 700);
    return () => clearTimeout(timer);
  }, [ready]);
  const setTour = (open: boolean) => {
    setTourOpen(open);
    if (!open) localStorage.setItem(`reweave-tour-seen-${user.uid}`, "1");
  };

  useEffect(() => {
    localStorage.setItem("reweave-language", lang);
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = state.dark ? "dark" : "light";
    if (!ready) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}-${user.uid}`, JSON.stringify({ ...state, garments: [] })); // photos live in Firestore, not here
    } catch (error) {
      console.warn("Could not write the local cache", error);
    }
    // debounce: one Firestore write after changes settle (saves free-tier quota)
    const timer = setTimeout(() => {
      saveUser(user.uid, { profile: state.profile, points: state.points, dark: state.dark, plant: state.plant, wateredOn: state.wateredOn, postBonusOn: state.postBonusOn, closets: state.closets }).catch((error) => console.error("Save failed", error));
    }, 800);
    return () => clearTimeout(timer);
  }, [state, lang, ready]);

  useEffect(() => {
    localStorage.setItem(`reweave-notifications-${user.uid}`, JSON.stringify(notificationPreferences));
  }, [notificationPreferences, user.uid]);

  const heading = useMemo(() => {
    const firstName = state.profile.displayName.split(" ")[0] || "there";
    if (tab === "plant") return { title: `${t.morning}, ${firstName}.`, eyebrow: new Date().toLocaleDateString(lang === "th" ? "th-TH" : "en", { weekday: "long", month: "long", day: "numeric" }) };
    if (tab === "closet") return { title: t.wardrobe, eyebrow: t.wardrobeSub };
    if (tab === "community") return { title: t.circle, eyebrow: t.circleSub };
    return { title: t.space, eyebrow: t.spaceSub };
  }, [tab, state.profile.displayName, lang]);

  const waterPlant = async () => {
    setState((current) => {
      if (!current.plant.alive || current.wateredOn === TODAY) return current;
      const caredDays = current.plant.caredDays + 1;
      // reaching stage 4 unlocks one buying credit (once)
      const grant = plantStage(caredDays) >= 4 && !current.plant.creditGranted;
      const profile = {
        ...current.profile,
        points: current.profile.points + 1,
        buyingCredits: current.profile.buyingCredits + (grant ? 1 : 0),
      };
      return {
        ...current,
        wateredOn: TODAY,
        points: profile.points,
        profile,
        plant: { ...current.plant, lastWatered: TODAY, caredDays, streak: current.plant.streak + 1, creditGranted: current.plant.creditGranted || grant },
      };
    });
  };

  const claimPostBonus = () => {
    setState((current) => current.postBonusOn === TODAY ? current : {
      ...current,
      postBonusOn: TODAY,
      points: current.points + 3,
      profile: { ...current.profile, points: current.profile.points + 3 },
    });
  };

  const addCloset = (rawName: string): string | null => {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name) return "Please give your closet a name.";
    if (name.length > 24) return "Keep it under 24 characters.";
    if (state.closets.some((closet) => closet.toLowerCase() === name.toLowerCase())) return "You already have a closet with that name.";
    setState((current) => ({ ...current, closets: [...current.closets, name] }));
    return null;
  };

  // Deleting a closet moves its clothes to the default closet. The default closet can't be deleted.
  const deleteCloset = (name: string) => {
    if (name === DEFAULT_CLOSET) return;
    const moving = state.garments.filter((garment) => garment.closet === name).map((garment) => garment.id);
    if (moving.length) setGarmentsCloset(user.uid, moving, DEFAULT_CLOSET).catch(syncFailed);
    setState((current) => ({
      ...current,
      closets: current.closets.filter((closet) => closet !== name),
      garments: current.garments.map((garment) => garment.closet === name ? { ...garment, closet: DEFAULT_CLOSET } : garment),
    }));
  };

  const replant = () => {
    setState((current) => ({ ...current, wateredOn: null, plant: freshPlant(TODAY) }));
  };

  const syncFailed = (error: unknown) => {
    console.error("Sync failed", error);
    setNotice("Couldn’t save to the cloud. Check your connection and try again.");
  };

  const createGarment = async (garment: Garment) => {
    const saved = { ...garment, id: String(Date.now()) };
    setState((current) => ({ ...current, garments: [saved, ...current.garments] }));
    try { await saveGarment(user.uid, saved as any); } catch (error) { syncFailed(error); }
  };

  const updateGarment = async (id: Garment["id"], changes: Partial<Garment>) => {
    setState((current) => ({ ...current, garments: current.garments.map((garment) => garment.id === id ? { ...garment, ...changes } : garment) }));
    try { await saveGarment(user.uid, { ...changes, id } as any); } catch (error) { syncFailed(error); }
  };

  const deleteGarment = async (id: Garment["id"]) => {
    setState((current) => ({ ...current, garments: current.garments.filter((garment) => garment.id !== id) }));
    try { await removeGarment(user.uid, id); } catch (error) { syncFailed(error); }
  };

  const saveProfile = async (changes: Partial<Profile>) => {
    setState((current) => ({ ...current, profile: { ...current.profile, ...changes } }));
  };

  const purchase = async (listing: MarketplaceListing, paymentMethod: DemoPaymentMethod) => {
    await completeMockPurchase(listing, user.uid, state.profile.displayName, paymentMethod);
    setState((current) => {
      const hasCredit = current.profile.buyingCredits > 0;
      const profile = {
        ...current.profile,
        buyingCredits: Math.max(0, current.profile.buyingCredits - 1),
        points: current.profile.points + 50,
      };
      return { ...current, profile, points: profile.points, plant: hasCredit ? current.plant : { ...current.plant, alive: false, streak: 0 } };
    });
  };

  const createListing = (listing: MarketplaceListing) => createMarketplaceListing(listing);
  const deleteListing = (listing: MarketplaceListing) => deleteMarketplaceListing(listing.id, user.uid);

  const friendWater = async (friend: CommunityFriend) => {
    try {
      const helped = await helpCommunityFriend(friend.chatId, user.uid, TODAY);
      if (!helped) return;
      setState((current) => ({ ...current, points: current.points + 5, profile: { ...current.profile, points: current.profile.points + 5 } }));
    } catch (error) {
      console.error("Could not help a friend's garden", error);
      setNotice(lang === "th" ? "ช่วยดูแลต้นฝ้ายไม่สำเร็จ ตรวจสอบกฎ Firestore" : "Could not help this garden. Check the Firestore friendship rules.");
    }
  };
  const openChat = (friend: CommunityFriend) => {
    setActiveChatFriend(friend);
    setFriendsOpen(false);
    setChatOpen(true);
  };

  if (!ready) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--ink-soft)" }}>Loading your garden…</div>;

  return (
    <LanguageContext.Provider value={{ lang, t }}>
    <div className="app-shell">
      {import.meta.env.DEV && <DevPanel setState={setState} />}
      <div className="brand-rail">
        <button className="brand" onClick={() => setTab("plant")}><span><Leaf size={17} /></span> reweave</button>
        <div className="rail-note"><span>CARE / WEAR / SHARE</span><button className="secondary-button" onClick={logout} style={{ marginTop: 12 }}>Log out</button></div>
      </div>
      <main>
        <Header title={heading.title} eyebrow={heading.eyebrow} dark={state.dark} notificationCount={notificationCount} onTheme={() => setState((current) => ({ ...current, dark: !current.dark }))} onLanguage={() => setLang((current) => current === "en" ? "th" : "en")} onChat={() => setFriendsOpen(true)} onNotifications={() => setNotificationsOpen(true)} />
        {tab === "plant" && <PlantView state={state} onWater={waterPlant} onReplant={replant} />}
        {tab === "closet" && <ClosetView state={state} userId={user.uid} onCreate={createGarment} onUpdate={updateGarment} onDelete={deleteGarment} onAddCloset={addCloset} onDeleteCloset={deleteCloset} onPurchase={purchase} onDeleteListing={deleteListing} />}
        {tab === "community" && <CommunityView state={state} userId={user.uid} onPosted={claimPostBonus} onPurchase={purchase} onDeleteListing={deleteListing} onCreateListing={createListing} />}
        {tab === "profile" && <ProfileView state={state} userId={user.uid} friends={friends} unreadByChat={unreadByChat} setState={setState} onSaveProfile={saveProfile} notifications={notificationPreferences} onSaveNotifications={setNotificationPreferences} onChat={() => setFriendsOpen(true)} onFriendWater={friendWater} onChatWithFriend={openChat} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
      <HelpTour lang={lang} setTab={setTab} open={tourOpen} setOpen={setTour} />
      {notice && <div className="toast" role="status">{notice}</div>}
      {inboxError && <div className="toast" role="alert">{inboxError}</div>}
      {notificationsOpen && <NotificationSheet waterDue={waterReminderDue} activities={activities} error={notificationError} onClose={() => setNotificationsOpen(false)} onWater={() => void waterPlant()} onOpenCommunity={() => { setTab("community"); setNotificationsOpen(false); }} />}
      {friendsOpen && <FriendListSheet friends={friends} unreadByChat={unreadByChat} onClose={() => setFriendsOpen(false)} onSelect={openChat} />}
      {chatOpen && activeChatFriend && <ChatSheet friend={activeChatFriend} userId={user.uid} userName={state.profile.displayName} onClose={() => setChatOpen(false)} />}
    </div>
    </LanguageContext.Provider>
  );
}