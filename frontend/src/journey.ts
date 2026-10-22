/** Geometry for the sign-in journey line, in its 550×190 viewBox. Pure functions; AuthGate drives them from one rAF loop. */
export type Pt={x:number;y:number}

export const REST:Pt[]=[{x:20,y:152},{x:168,y:152},{x:276,y:44},{x:530,y:44}]

/** Each rest point leans toward the pointer: nearer points move more, never past the pointer and never more than `maxOffset`. */
export function journeyTargets(pointer:Pt|null,maxOffset=28):Pt[]{
  if(!pointer)return REST
  return REST.map(p=>{
    const dx=pointer.x-p.x,dy=pointer.y-p.y,dist=Math.hypot(dx,dy)
    if(dist===0)return p
    const move=Math.min(maxOffset/(1+dist/180),dist)
    return {x:p.x+dx/dist*move,y:p.y+dy/dist*move}
  })
}

/** One damped-lerp step; snaps to the target once every delta is under 0.1. */
export function stepToward(current:Pt[],target:Pt[],k=0.14):{points:Pt[];settled:boolean}{
  const settled=current.every((p,i)=>Math.abs(target[i].x-p.x)<0.1&&Math.abs(target[i].y-p.y)<0.1)
  if(settled)return {points:target,settled}
  return {points:current.map((p,i)=>({x:p.x+(target[i].x-p.x)*k,y:p.y+(target[i].y-p.y)*k})),settled}
}

const n=(v:number)=>+v.toFixed(2)

export function pathD(points:Pt[],offset:Pt={x:0,y:0}):string{
  return points.map((p,i)=>`${i?'L':'M'}${n(p.x+offset.x)} ${n(p.y+offset.y)}`).join(' ')
}

/** The point on the polyline at horizontal position `x`, clamped to its ends. Assumes x increases along the line. */
export function nearestOnPath(points:Pt[],x:number):Pt{
  const first=points[0],last=points[points.length-1]
  if(x<=first.x)return {...first}
  if(x>=last.x)return {...last}
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i]
    if(x<=b.x)return {x,y:b.x===a.x?b.y:a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)}
  }
  return {...last}
}
