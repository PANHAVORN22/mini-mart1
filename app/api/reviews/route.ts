import { NextResponse } from "next/server";
import { createReview, getReviewsForProduct } from "@/lib/actions/reviews";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { success: false, error: "Missing productId" },
        { status: 400 }
      );
    }

    const data = await getReviewsForProduct(productId);
    return NextResponse.json({ success: true, reviews: data });
  } catch (err) {
    console.error("Reviews GET error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, rating, comment } = body;

    if (!productId || !rating) {
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const result = await createReview(productId, Number(rating), comment);

    if (!result.success && result.error === "Unauthorized") {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Reviews POST error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
