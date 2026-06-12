import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SAMPLE = `item_name,hindi_name,category,cuisine_type,price,is_veg,description,prep_time_minutes,photo_url,emoji,available,spice_level,tags
Tandoori Roti,तंदूरी रोटी,Bread,North Indian,30,true,Whole wheat tandoor bread,6,,🫓,true,0,bread,tandoor
Chilli Paneer,चिली पनीर,Chinese,Indo-Chinese,240,true,Spicy Indo-Chinese paneer,15,,🌶️,true,3,chinese,spicy,starter
Mutton Rogan Josh,मटन रोगन जोश,Main Course,Kashmiri,360,false,Aromatic Kashmiri mutton curry,28,,🍛,true,2,mutton,gravy`;

export async function GET() {
  return new NextResponse(SAMPLE, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="dinex-menu-sample.csv"',
    },
  });
}
