import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BookTruckOrder, ConfirmPurchase, QuantityConfirmed, RequestUpdate } from "../screens/AcceptFlow";
import { CropDetail } from "../screens/CropDetail";
import { HomeFeed } from "../screens/HomeFeed";
import { MyOrders, Profile } from "../screens/OrdersProfile";
import { RequestDetails, RequestSent, ReviewRequest, SelectQuantity } from "../screens/RequestFlow";
import {
  DeliveryCompleted,
  FindingTruck,
  ReviewBooking,
  TrackTruck,
  TruckConfirmed,
} from "../screens/TripFlow";
import { BookTrackHome, ChooseOrder, NearbyTrucks, PickupDelivery, TruckDetails } from "../screens/TruckFlow";
import { colors } from "../theme";
import type { RootStackParamList, TabParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.cream },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: focused ? "home" : "home-outline",
            BookTrack: focused ? "car" : "car-outline",
            Orders: focused ? "clipboard" : "clipboard-outline",
            Profile: focused ? "person" : "person-outline",
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeFeed} />
      <Tab.Screen name="BookTrack" component={BookTrackHome} options={{ title: "Book Track" }} />
      <Tab.Screen name="Orders" component={MyOrders} options={{ title: "My Orders" }} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="CropDetail" component={CropDetail} />
        <Stack.Screen name="SelectQuantity" component={SelectQuantity} />
        <Stack.Screen name="ReviewRequest" component={ReviewRequest} />
        <Stack.Screen name="RequestSent" component={RequestSent} />
        <Stack.Screen name="RequestDetails" component={RequestDetails} />
        <Stack.Screen name="RequestUpdate" component={RequestUpdate} />
        <Stack.Screen name="ConfirmPurchase" component={ConfirmPurchase} />
        <Stack.Screen name="QuantityConfirmed" component={QuantityConfirmed} />
        <Stack.Screen name="BookTruckOrder" component={BookTruckOrder} />
        <Stack.Screen name="ChooseOrder" component={ChooseOrder} />
        <Stack.Screen name="PickupDelivery" component={PickupDelivery} />
        <Stack.Screen name="NearbyTrucks" component={NearbyTrucks} />
        <Stack.Screen name="TruckDetails" component={TruckDetails} />
        <Stack.Screen name="ReviewBooking" component={ReviewBooking} />
        <Stack.Screen name="FindingTruck" component={FindingTruck} />
        <Stack.Screen name="TruckConfirmed" component={TruckConfirmed} />
        <Stack.Screen name="TrackTruck" component={TrackTruck} />
        <Stack.Screen name="DeliveryCompleted" component={DeliveryCompleted} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
