export type CommunityComment = {
  id: string;
  ownerId: string;
  name: string;
  text: string;
  createdAt: number;
};

export type CommunityGarment = {
  id: string;
  name: string;
  type: string;
  color: string;
  material: string;
  style?: string;
  occasion?: string;
};

export type FashionPost = {
  id: string;
  ownerId?: string;
  name: string;
  handle: string;
  avatar?: string;
  authorBio?: string;
  image: string;
  look: string;
  caption: string;
  tags: string;
  style?: string;
  likes: number;
  likedBy?: string[];
  privacy: "public" | "private";
  garmentIds: string[];
  taggedPieces?: CommunityGarment[];
  comments: CommunityComment[];
  createdAt?: number;
};

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  seller: string;
  sellerHandle: string;
  sellerAvatar?: string;
  name: string;
  type: string;
  size: string;
  price: number;
  image: string;
  material: string;
  condition: string;
  description: string;
  style: string;
  tags: string[];
  createdAt: number;
  sold: boolean;
};

export type DemoPaymentMethod = "promptpay" | "qr";
