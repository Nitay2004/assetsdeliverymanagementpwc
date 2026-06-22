import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const email = 'admin@devit.com';
    const password = 'password123';
    
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: 'Admin User',
        passwordHash,
        role: 'ADMIN',
      },
    });

    // Seed Inventory
    const inventoryCount = await prisma.inventoryItem.count();
    if (inventoryCount === 0) {
      const laptops = Array.from({ length: 15 }).map((_, i) => ({
        serialNumber: `SN-HP-${10000 + i}`,
        model: 'HP EliteBook 840 G8',
        specs: '16GB RAM, 512GB SSD, Intel i7',
        status: 'AVAILABLE' as const,
      }));
      await prisma.inventoryItem.createMany({ data: laptops });
    }

    // Seed Orders
    const orderCount = await prisma.order.count();
    if (orderCount === 0) {
      await prisma.order.create({
        data: {
          clientName: 'PWC',
          intermediary: 'HP',
          totalQuantity: 2,
          deliveryLocation: 'PWC Mumbai Office',
          status: 'ORDER_PLACED',
          assets: {
            create: [
              { status: 'pending' },
              { status: 'pending' }
            ]
          }
        }
      });

      const allocatedLaptop = await prisma.inventoryItem.create({
        data: {
          serialNumber: 'SN-HP-998877',
          model: 'HP ProBook 450 G8',
          specs: '8GB RAM, 256GB SSD',
          status: 'ALLOCATED'
        }
      });

      await prisma.order.create({
        data: {
          clientName: 'PWC',
          intermediary: 'HP',
          totalQuantity: 1,
          deliveryLocation: 'PWC Bangalore',
          status: 'ALLOCATED',
          assets: {
            create: [
              { status: 'qc_pass', inventoryItemId: allocatedLaptop.id }
            ]
          }
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Admin user and dummy orders created successfully!',
      user: {
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
