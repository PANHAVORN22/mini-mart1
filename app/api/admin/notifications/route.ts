import { NextResponse } from "next/server";
import {
  getNotifications,
  markNotificationRead,
  updateOrderStatus,
} from "@/lib/actions/admin";

export async function GET() {
  try {
    const notifications = await getNotifications(50);
    return NextResponse.json({ success: true, data: notifications });
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    const message =
      err instanceof Error ? err.message : "Failed to fetch notifications";
    const status =
      message === "Not authenticated"
        ? 401
        : message === "Forbidden"
        ? 403
        : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    if (!body || !body.action) {
      return NextResponse.json(
        { success: false, error: "Missing action" },
        { status: 400 }
      );
    }

    if (body.action === "markRead") {
      const { notificationId } = body;
      if (!notificationId)
        return NextResponse.json(
          { success: false, error: "Missing notificationId" },
          { status: 400 }
        );

      const res = await markNotificationRead(notificationId);
      if (!res.success)
        return NextResponse.json(
          { success: false, error: res.error || "Failed" },
          { status: 400 }
        );
      return NextResponse.json({ success: true });
    }

    if (body.action === "setOrderStatus") {
      const { orderId, status } = body;
      if (!orderId || !status)
        return NextResponse.json(
          { success: false, error: "Missing orderId or status" },
          { status: 400 }
        );

      const res = await updateOrderStatus(orderId, status);
      if (!res.success)
        return NextResponse.json(
          { success: false, error: res.error || "Failed" },
          { status: 400 }
        );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Failed to handle PATCH on notifications:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
