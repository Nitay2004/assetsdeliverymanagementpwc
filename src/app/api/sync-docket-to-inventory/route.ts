import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }
  if (!canViewModule(user.permissions, user.role, "logistics")) {
    return NextResponse.json(
      { success: false, error: "Forbidden." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const docketId = searchParams.get("docketId");
  const orderId = searchParams.get("orderId");

  if (!docketId && !orderId) {
    return NextResponse.json(
      { success: false, error: "Either docketId or orderId is required." },
      { status: 400 }
    );
  }

  try {
    let dockets;
    if (docketId) {
      dockets = await prisma.docket.findMany({
        where: { id: docketId },
        include: {
          order: {
            include: {
              assets: {
                include: { inventoryItem: true },
              },
            },
          },
        },
      });
    } else if (orderId) {
      dockets = await prisma.docket.findMany({
        where: { orderId },
        include: {
          order: {
            include: {
              assets: {
                include: { inventoryItem: true },
              },
            },
          },
        },
      });
    }

    if (!dockets || dockets.length === 0) {
      return NextResponse.json(
        { success: false, error: "No dockets found." },
        { status: 404 }
      );
    }

    // For each docket, find the linked inventory items via order -> assets -> inventoryItem
    const syncResults = await Promise.all(
      dockets.map(async (docket) => {
        const order = docket.order;
        if (!order?.assets) {
          return { docketNumber: docket.docketNumber, syncedItems: 0, error: "No assets on order" };
        }

        const inventoryItemIds = order.assets
          .filter((a) => a.inventoryItem)
          .map((a) => a.inventoryItem!.id);

        const inventoryItems = await prisma.inventoryItem.findMany({
          where: {
            id: { in: inventoryItemIds },
          },
        });

        // Update inventory item DC fields from the docket
        const updatePromises = inventoryItems.map((item) =>
          prisma.inventoryItem.update({
            where: { id: item.id },
            data: {
              dcNumber: docket.docketNumber ?? item.dcNumber,
              latestDc: docket.docketNumber ?? item.latestDc,
            },
          })
        );

        const updatedCount = await Promise.all(updatePromises).then((res) => res.filter((u) => u).length);

        return {
          docketNumber: docket.docketNumber,
          inventoryItemCount: inventoryItems.length,
          syncedItems: updatedCount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      results: syncResults,
    });
  } catch (error) {
    console.error("sync-docket-to-inventory error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}