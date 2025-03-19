import React from 'react'
import { PiShoppingCartBold } from "react-icons/pi";


export default function ShoppingCart({ cart }) {
  return (
    <div  className='relative hover:scale-105 cursor-pointer'>
        <PiShoppingCartBold size={24}/> 
        <div className='absolute top-[-5px] right-[-8px] w-[20px] h-[20px] brand-accent-bg-color brand-color flex justify-center items-center rounded-full text-[10px] font-bold'>{cart.length}</div>
    </div>
  )
}
