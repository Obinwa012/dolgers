import React from 'react'
import {  PiDress, PiTShirt, PiDeviceMobileCamera, PiHeartbeat, PiBowlSteam, PiHouse, PiLego, PiSoccerBall, PiCar, PiBook, PiBaby, PiCake, PiFlowerLotus, PiPalette, PiDog, PiBuildings, PiAppWindow } from 'react-icons/pi';


export default function CategoryIcons({ index }) {
    const categoryIcons = [<PiDress />, <PiTShirt />, <PiDeviceMobileCamera />, <PiHeartbeat />, <PiBowlSteam />, <PiHouse />, <PiLego />, <PiSoccerBall />, <PiCar />, <PiBook />, <PiBaby />, <PiCake />, <PiFlowerLotus />, <PiPalette />, <PiDog />, <PiBuildings />, <PiAppWindow />];

    return categoryIcons[index]
}