import Link from 'next/link'
import React from 'react'

export default function Logo() {
  return (
    <Link href='/'>
      <h1 className='dolgers-title logo-style text-white ml-[14px] md:ml-[0px]'>
          DOLGERS
      </h1>
    </Link>
  )
}
