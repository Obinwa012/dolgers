'use client'
import React, { useState } from 'react'
import CategoryIcons from './CategoryIcons'
import { useRouter } from 'next/navigation';
import categories from '@/libs/dictionary/categories';
import handleSanitizedLink from '@/functions/sanitizeLink';
import useLeftDrawer from '@/stores/leftDrawer/useLeftDrawer';
import { PiCaretRightBold, PiCaretLeftBold } from "react-icons/pi";
import leftDrawerContent from '@/stores/leftDrawer/leftDrawerContent';



export default function MobileMenu() {
    const router = useRouter();
    const [currentCategory, setCurrentCategory] = useState('none');
    const toggleLeftDrawer = useLeftDrawer((state) => state.toggleLeftDrawer);
    const setLeftDrawerType = leftDrawerContent((state) => state.setLeftDrawerType)

    const handleOpenRoute = async (link) => {
        try{
            const sanitizedLink = await handleSanitizedLink(link);
            router.push(sanitizedLink);
            toggleLeftDrawer();
            setLeftDrawerType('none');
        }catch(e){
            console.log(e);
        }
    }
  

  if(currentCategory === 'none') {
    return (
        <main className='w-full h-dvh custom-scrollbar overflow-y-scroll  brand-bg-color px-[8%]'>
    
            <section className='w-full h-[70px] text-[21px] font-bold text-white flex items-center justify-start border-gray-700 border-b-[0.1px]'>
                <h1>Categories</h1>
            </section>
    
            <section className='my-[20px]  pb-[20px] border-gray-700 border-b-[0.1px]'>
                {
                    Object.keys(categories).map((category, index) => {
                        return (
                            <div key={index} className='w-full h-[50px] flex items-center justify-between text-gray-400 text-[21px] cursor-pointer' onClick={() => category === 'Others'? handleOpenRoute('allcategories') : setCurrentCategory(category)}>
                                <div className='flex items-center justify-start'>
                                    <CategoryIcons index={index}/>
                                    <h1 className='text-[14px] ml-[14px] text-white'>{category}</h1>
                                </div>
                                <PiCaretRightBold size={12} className={`${category === 'Others'? 'hidden' : 'block'}`}/>
                            </div>
                        )
                    })
                }
            </section>
    
        </main>
      )
  }else{
    return (
        <main className='w-full h-dvh custom-scrollbar overflow-y-scroll bg-white'>
    
            <section className='w-full h-[70px] text-[14] font-extrabold cursor-pointer text-white px-[8%] brand-bg-color flex items-center justify-start' onClick={() => setCurrentCategory('none')}>
                <PiCaretLeftBold />
                <h1 className='ml-[14px] text-ellipsis  '>{currentCategory}</h1>
            </section>
    
            <section className='my-[20px]  pb-[20px] px-[8%]'>
                {
                    Object.keys(categories[currentCategory]).map((subCategory, index) => {
                        return (
                            <div key={index} className='w-full h-[50px] flex items-center justify-between text-gray-400 text-[14px] cursor-pointer'  onClick={() => subCategory === "View All"? handleOpenRoute('/' + currentCategory) : handleOpenRoute('/' + currentCategory + '/' + subCategory)}>
                                <h1 className='text-[#00233d]'>{subCategory}</h1>
                            </div>
                        )
                    })
                }
            </section>
    
        </main>
      )
  } 
}
