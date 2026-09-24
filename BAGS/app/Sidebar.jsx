
import { Image } from "expo-image"; 
import React, { Children } from "react";
import { Text,TouchableOpacity } from "react-native";




export default function Sidebar({  }){
    return(
        <aside className="h-screen">  
            <nav className="h-full flex flex-col bg-white boeder-r shadow-sm">
                <view className="p-4 pb-2 justify-between items-center">
                    <Image source={require("../assets/bag.png")} className="w-32" alt="Logo"/>
                    <TouchableOpacity className="p-1.5 rounded-lg bg-grey-50 hover:bg-grey-100">
                      
                    </TouchableOpacity>
                </view>
                <ul className="flex-1 px-3">{Children}</ul>
                <view className="border-t flex p-3">
                    <Image source={require("../assets/bag.png")} className="w-10 h-10 rounded-md " alt="Profile"/>
                </view>
                <view className={`flex justify-between items-center w-52 ml-3`}>
                    <Text>BOATENG ADAMS</Text>
                </view>
            </nav>
        </aside>
    )
}

