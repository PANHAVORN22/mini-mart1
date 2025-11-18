"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service";

interface OrderItem {
  beerId: string;
  quantity: number;
  price: number;
}

interface CheckoutData {
  fullName: string;
  email: string;
  phone: string;
  houseNumber: string;
  street: string;
  city: string;
  zipCode: string;
}

export async function createOrder(
  items: OrderItem[],
  checkoutData: CheckoutData,
  userId: string
) {
  const supabase = await getSupabaseServerClient();
  // Prefer calling a DB-side function that performs the entire create-order
  // logic inside a single transaction. This ensures the stock check and
  // decrement happen atomically and avoids race conditions.
  try {
    const rpcPayload = {
      p_user_id: userId,
      p_items: items,
      p_checkout: checkoutData,
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "create_order_transaction",
      rpcPayload
    );

    if (rpcError) {
      console.error("create_order_transaction RPC error:", rpcError);
      const rpcMessage =
        rpcError.message ||
        rpcError.details ||
        rpcError.hint ||
        "Failed to create order (server error)";
      return { success: false, error: rpcMessage };
    }

    // RPC returns rows with success/order_id/error_text
    // PostgREST will return an array of rows; pick first
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    if (!row || !row.success) {
      // If the DB function returned an error_text (e.g. insufficient), pass it along
      const errText = row?.error_text || "Failed to create order";
      // try to parse insufficient details if provided as JSON text
      try {
        const parsed = JSON.parse(errText);
        return {
          success: false,
          error: "Insufficient stock for one or more items",
          insufficient: parsed,
        };
      } catch (e) {
        return { success: false, error: errText };
      }
    }

    const orderId = row.order_id;

    // Ensure admins always get a notification for fresh orders. The DB RPC
    // already attempts to insert one, but this fallback covers older
    // migrations or partial setups where the notifications table was missing
    // and prevents duplicate inserts.
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const pointsEarned = Math.floor(totalAmount);

    if (pointsEarned > 0) {
      try {
        const service = getSupabaseServiceRoleClient();

        const { error: pointsError } = await service.rpc(
          "service_award_purchase_points",
          {
            target_user: userId,
            points: pointsEarned,
            reason: "Order purchase",
            metadata: {
              orderId,
              total: totalAmount,
            },
          }
        );

        if (pointsError) {
          console.error("Failed to award premium points:", pointsError);
        }
      } catch (pointsException) {
        console.error(
          "service_award_purchase_points RPC failed:",
          pointsException
        );
      }
    }

    const notificationPayload = {
      user_id: userId,
      order_id: orderId,
      type: "new_order" as const,
      message: `New order ${orderId} placed`,
      metadata: {
        total: totalAmount,
        contactInfo: {
          fullName: checkoutData.fullName,
          email: checkoutData.email,
          phone: checkoutData.phone,
        },
        shippingAddress: {
          houseNumber: checkoutData.houseNumber,
          street: checkoutData.street,
          city: checkoutData.city,
          zipCode: checkoutData.zipCode,
        },
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      },
    };

    let notificationWritten = false;

    try {
      const service = getSupabaseServiceRoleClient();

      const { data: existingRows, error: lookupErr } = await service
        .from("notifications")
        .select("id")
        .eq("order_id", orderId)
        .eq("type", "new_order")
        .limit(1);

      if (lookupErr) {
        console.error("Notification lookup failed:", lookupErr);
      }

      const hasExisting =
        Array.isArray(existingRows) && existingRows.length > 0;

      if (!hasExisting) {
        const { error: insertErr } = await service
          .from("notifications")
          .insert(notificationPayload);

        if (insertErr) {
          console.error("Notification insert failed (service):", insertErr);
        } else {
          notificationWritten = true;
        }
      } else {
        notificationWritten = true;
      }
    } catch (notificationErr) {
      console.error(
        "Service-role notification attempt failed:",
        notificationErr
      );
    }

    if (!notificationWritten) {
      try {
        const { error: fallbackErr } = await supabase
          .from("notifications")
          .insert(notificationPayload);

        if (fallbackErr) {
          console.error("Notification insert failed (session):", fallbackErr);
        } else {
          notificationWritten = true;
        }
      } catch (fallbackException) {
        console.error(
          "Fallback notification attempt failed:",
          fallbackException
        );
      }
    }

    revalidatePath("/orders");
    revalidatePath("/admin");

    return { success: true, orderId };
  } catch (err) {
    console.error("createOrder error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function getUserOrders(userId: string) {
  const supabase = await getSupabaseServerClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        beers (*)
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    total: Number(order.total),
    createdAt: order.created_at,
    shippingAddress: order.shipping_address,
    contactInfo: order.contact_info,
    items: order.order_items.map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      price: Number(item.price),
      beer: {
        id: item.beers.id,
        name: item.beers.name,
        type: item.beers.type,
        price: Number(item.beers.price),
        imageUrl: item.beers.image_url || "/placeholder.svg",
      },
    })),
  }));
}

export async function getOrderById(orderId: string) {
  const supabase = await getSupabaseServerClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        beers (*)
      )
    `
    )
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return null;
  }

  return {
    id: order.id,
    status: order.status,
    total: Number(order.total),
    createdAt: order.created_at,
    shippingAddress: order.shipping_address,
    contactInfo: order.contact_info,
    items: order.order_items.map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      price: Number(item.price),
      beer: {
        id: item.beers.id,
        name: item.beers.name,
        type: item.beers.type,
        price: Number(item.beers.price),
        imageUrl: item.beers.image_url || "/placeholder.svg",
      },
    })),
  };
}
