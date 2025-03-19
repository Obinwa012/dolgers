import React from 'react'
import { PiHeartBold } from "react-icons/pi";


export default function Wishlist({ favorites }) {
  return (
    <div  className='relative hover:scale-105 cursor-pointer'>
        <PiHeartBold size={24}/> 
        <div className='absolute top-[-5px] right-[-8px] w-[20px] h-[20px] brand-accent-bg-color brand-color flex justify-center items-center rounded-full text-[10px] font-bold'>{favorites.length}</div>
    </div>
  )
}
