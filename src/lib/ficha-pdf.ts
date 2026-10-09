import {PDFDocument, rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sansUrl from './space-grotesk-400-pdf.ttf?url';
import sansBoldUrl from './space-grotesk-700-pdf.ttf?url';
import serifUrl from './source-serif-400-pdf.ttf?url';
import serifBoldUrl from './source-serif-700-pdf.ttf?url';

const WIDTH=595.276,HEIGHT=841.89,LEFT=48,RIGHT=48,TOP=53,BOTTOM=60,CONTENT=WIDTH-LEFT-RIGHT;
const colors={ink:rgb(.09,.13,.11),forest:rgb(.09,.42,.39),muted:rgb(.34,.38,.36),rule:rgb(.78,.78,.75)};
const fontBytes=async(url:string)=>new Uint8Array(await(await fetch(url)).arrayBuffer());
function wrap(raw:string,font:any,size:number,width:number):string[]{
  const result:string[]=[];
  for(const paragraph of raw.replace(/\u00a0/g,' ').split(/\n/)){
    if(!paragraph.trim()){result.push('');continue}
    let row='';
    for(const word of paragraph.trim().split(/\s+/)){
      if(font.widthOfTextAtSize(row?`${row} ${word}`:word,size)<=width){row=row?`${row} ${word}`:word;continue}
      if(row){result.push(row);row=''}
      for(const char of word){if(row&&font.widthOfTextAtSize(row+char,size)>width){result.push(row);row=''}row+=char}
    }
    if(row)result.push(row);
  }
  return result;
}
type Article={short:string;heading:string;rubric:string;blocks:{text:string;marker?:string}[];citation:string};
/** Export what is currently rendered, including unsaved-in-flight contenteditable text. */
export async function downloadFichaPdf(title:string,articles:Article[],source:string){
  if(!articles.length)throw Error('No hay artículos disponibles para exportar.');
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const [i,ib,s,sb]=await Promise.all([sansUrl,sansBoldUrl,serifUrl,serifBoldUrl].map(fontBytes));
  const fonts={sans:await pdf.embedFont(i),sansBold:await pdf.embedFont(ib),serif:await pdf.embedFont(s),serifBold:await pdf.embedFont(sb)};
  pdf.setTitle(title.trim()||'Ficha de artículos - Normativa Uruguay');pdf.setCreator('Normativa Uruguay');
  let page=pdf.addPage([WIDTH,HEIGHT]),y=TOP;
  const next=()=>{page=pdf.addPage([WIDTH,HEIGHT]);y=TOP};
  const need=(height:number)=>{if(y+height>HEIGHT-BOTTOM)next()};
  const line=(value:string,font:any,size:number,leading:number,color=colors.ink,x=LEFT)=>{
    need(leading);page.drawText(value,{x,y:HEIGHT-y-size,font,size,color});y+=leading;
  };
  const paragraph=(value:string,font:any,size:number,leading:number,width=CONTENT,x=LEFT,color=colors.ink)=>{
    for(const row of wrap(value,font,size,width)){if(row)line(row,font,size,leading,color,x);else{need(leading);y+=leading}}
  };
  if(title.trim()){
    paragraph(title.trim(),fonts.serifBold,22,26);need(16);y+=8;
    page.drawLine({start:{x:LEFT,y:HEIGHT-y},end:{x:WIDTH-RIGHT,y:HEIGHT-y},thickness:1,color:colors.forest});y+=16;
  }
  for(let index=0;index<articles.length;index++){
    const a=articles[index];need(90); // Keep heading and first lines together.
    line(a.short.toUpperCase(),fonts.sansBold,8,15,colors.forest);
    paragraph(a.heading,fonts.serifBold,16,20);if(a.rubric)paragraph(a.rubric,fonts.serif,12,17,CONTENT,LEFT,colors.forest);
    need(7);y+=7;
    for(const block of a.blocks){
      if(!block.text.trim()&&!block.marker)continue;
      if(block.marker){const markerWidth=37;need(32);const start=y,current=page;paragraph(block.text,fonts.serif,11,16,CONTENT-markerWidth,LEFT+markerWidth);current.drawText(block.marker,{x:LEFT,y:HEIGHT-start-9,font:fonts.sansBold,size:8.5,color:colors.forest});}
      else paragraph(block.text,fonts.serif,11,16);
      need(8);y+=8;
    }
    paragraph(a.citation,fonts.serif,9.5,14,CONTENT,LEFT,colors.muted);
    if(index<articles.length-1){need(23);y+=10;page.drawLine({start:{x:LEFT,y:HEIGHT-y},end:{x:WIDTH-RIGHT,y:HEIGHT-y},thickness:.5,color:colors.rule});y+=13}
  }
  need(32);y+=17;paragraph(source,fonts.sans,8.5,12,CONTENT,LEFT,colors.muted);
  const bytes=await pdf.save();const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const a=document.createElement('a');a.href=url;a.download='normativa-ficha.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
