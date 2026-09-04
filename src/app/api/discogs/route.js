import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const barcode = searchParams.get('barcode');

  if (!query && !barcode) {
    return NextResponse.json({ error: 'Query parameter "q" or "barcode" is required' }, { status: 400 });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return NextResponse.json({ error: 'Discogs credentials not configured' }, { status: 500 });
  }

  try {
    let url = `https://api.discogs.com/database/search?type=release&per_page=10`;
    if (barcode) {
      const cleanBarcode = barcode.replace(/[^0-9A-Za-z]/g, '');
      url += `&barcode=${encodeURIComponent(cleanBarcode)}`;
    } else {
      url += `&q=${encodeURIComponent(query)}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Discogs key=${key}, secret=${secret}`,
        'User-Agent': 'FreelancerDiscosTest/1.0'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Discogs API Error:', response.status, errorData);
      return NextResponse.json({ error: 'Failed to fetch from Discogs' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Discogs Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
