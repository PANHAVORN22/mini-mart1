import { NextResponse } from "next/server";
import {
  addToWishlist,
  removeFromWishlist,
  getWishlistForCurrentUser,
} from "@/lib/actions/wishlist";

export async function GET() {
  try {
    const data = await getWishlistForCurrentUser();
    return NextResponse.json({ success: true, items: data });
  } catch (err) {
    console.error("Wishlist GET error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId } = body;
    if (!productId)
      return NextResponse.json(
        { success: false, error: "Missing productId" },
        { status: 400 }
      );

    const result = await addToWishlist(productId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Wishlist POST error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    if (!productId)
      return NextResponse.json(
        { success: false, error: "Missing productId" },
        { status: 400 }
      );

    const result = await removeFromWishlist(productId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Wishlist DELETE error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
