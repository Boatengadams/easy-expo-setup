import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
const Home = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 items-center justify-between p-6">
          
        <View className="flex-1 items-center justify-center">
          <Pressable onPress={() => console.log("Image Pressed")}> 
          <Image
            source={require("../assets/bag.png")}
            style={{ width: 128, height: 128 }}
            className="mb-4"
            contentFit="contain"
          />
          </Pressable>
          <Pressable onLongPress ={() => console.log("Text Copied")}
                      onPress={() => console.log("Text Pressed")}>
            <Text className="text-white text-2xl font-bold">BAGSGRAPHICS</Text>
          </Pressable>



        <Modal visible={isModalVisible} transparent={true} animationType="slide" 
                  onRequestClose={() => setIsModalVisible(false)}
                  presentationStyle="pageSheet" >
                  


            <SafeAreaView className="flex-1 items-center justify-center bg-black bg-opacity-50">
            <View className="bg-white p-4 rounded-lg">
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Text className="text-black text-lg font-bold">close</Text>
              </TouchableOpacity>
            </View>

            </SafeAreaView>


        </Modal>


        </View>

        
        <TouchableOpacity 
          className="w-full bg-blue-600 py-4 rounded-xl items-center justify-center active:bg-blue-700"
          onPress={() => setIsModalVisible(true)}
        >
          <Text className="text-white text-lg font-bold">Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Home;