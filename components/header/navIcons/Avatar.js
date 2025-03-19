import React from 'react'

export default function Avatar({ customerData }) {
  return (
    <div className="avatar avatar-placeholder hover:scale-105 cursor-pointer">
        <div className="bg-gray-600 text-neutral-content w-[32px] rounded-full">
            <span className="text-xs">{customerData == null? 'DG' : customerData.name.slice(0,2).toString().toUpperCase()}</span>
        </div>
    </div>
  )
}
