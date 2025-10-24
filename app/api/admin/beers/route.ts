import { NextResponse } from 'next/server'
import { createBeer, updateBeer } from '@/lib/actions/admin'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, type, description, price, alcohol_content, volume, stock, image_url, is_premium } = body

    const result = await createBeer({
      name,
      type,
      description,
      price: Number(price),
      alcohol_content: alcohol_content ? Number(alcohol_content) : undefined,
      volume: volume ? Number(volume) : undefined,
      stock: Number(stock),
      image_url,
      is_premium: Boolean(is_premium),
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, beer: result.beer })
  } catch (err) {
    console.error('Create beer failed:', err)
    return NextResponse.json({ success: false, error: 'Create beer failed' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { id, data } = body

    const result = await updateBeer(id, {
      ...data,
      price: data.price !== undefined ? Number(data.price) : undefined,
      alcohol_content:
        data.alcohol_content !== undefined
          ? Number(data.alcohol_content)
          : undefined,
      volume: data.volume !== undefined ? Number(data.volume) : undefined,
      stock: data.stock !== undefined ? Number(data.stock) : undefined,
      is_premium: data.is_premium !== undefined ? Boolean(data.is_premium) : undefined,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update beer failed:', err)
    return NextResponse.json({ success: false, error: 'Update beer failed' }, { status: 500 })
  }
}
