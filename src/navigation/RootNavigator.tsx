import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Logo } from "../components/Logo";
import { AppProvider } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";

import { ChooseRole, CreateAccount, Login } from "../screens/Auth";
import { WrongApp } from "../screens/WrongApp";
import { Reconnect } from "../screens/Reconnect";
import { servesRole } from "../lib/appInfo";

// Buyer
import { BookTruckOrder, ConfirmPurchase, QuantityConfirmed } from "../screens/AcceptFlow";
import { CropDetail } from "../screens/CropDetail";
import { FarmerProfile } from "../screens/FarmerProfile";
import { HomeFeed } from "../screens/HomeFeed";
import { MyOrders, Profile } from "../screens/OrdersProfile";
import { RequestDetails, RequestSent, ReviewRequest, SelectQuantity } from "../screens/RequestFlow";
import { DeliveryCompleted, ReviewBooking, TrackTruck } from "../screens/TripFlow";
import { BookTrackHome, ChooseOrder, NearbyTrucks, PickupDelivery, TruckDetails } from "../screens/TruckFlow";

// Farmer
import { FarmerHome } from "../screens/farmer/FarmerHome";
import { Listings } from "../screens/farmer/Listings";
import { CropForm } from "../screens/farmer/CropForm";
import { FarmerRequests } from "../screens/farmer/Requests";
import { FarmerRequestDetail } from "../screens/farmer/RequestDetail";
import { FarmerAccount } from "../screens/farmer/FarmerAccount";
import { Demand } from "../screens/farmer/Demand";

// Driver
import { DriverJobs } from "../screens/driver/Jobs";
import { DriverTrips } from "../screens/driver/Trips";
import { TripDetail } from "../screens/driver/TripDetail";
import { DriverAccount } from "../screens/driver/DriverAccount";

// Shared
import { Verification } from "../screens/shared/Verification";
import { Help, MyTickets, NewTicket, TicketDetail } from "../screens/shared/Support";
import { Announcements } from "../screens/shared/Announcements";

import { colors } from "../theme";
import type {
  AuthStackParamList,
  DriverStackParamList,
  DriverTabParamList,
  FarmerStackParamList,
  FarmerTabParamList,
  RootStackParamList,
  TabParamList,
} from "./types";

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const BuyerStack = createNativeStackNavigator<RootStackParamList>();
const BuyerTab = createBottomTabNavigator<TabParamList>();
const FarmerStack = createNativeStackNavigator<FarmerStackParamList>();
const FarmerTab = createBottomTabNavigator<FarmerTabParamList>();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();
const DriverTab = createBottomTabNavigator<DriverTabParamList>();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.cream },
};

const stackOptions = { headerShown: false, animation: "slide_from_right" } as const;

function tabOptions(icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]>) {
  return ({ route }: { route: { name: string } }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.forest,
    tabBarInactiveTintColor: colors.faint,
    tabBarLabelStyle: { fontSize: 10, fontWeight: "600" as const },
    tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
    tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => {
      const pair = icons[route.name];
      return <Ionicons name={focused ? pair[0] : pair[1]} size={22} color={color} />;
    },
  });
}

// ---- Buyer -----------------------------------------------------------------

function BuyerTabs() {
  return (
    <BuyerTab.Navigator
      screenOptions={tabOptions({
        Home: ["home", "home-outline"],
        BookTrack: ["car", "car-outline"],
        Orders: ["clipboard", "clipboard-outline"],
        Profile: ["person", "person-outline"],
      })}
    >
      <BuyerTab.Screen name="Home" component={HomeFeed} />
      <BuyerTab.Screen name="BookTrack" component={BookTrackHome} options={{ title: "Book Track" }} />
      <BuyerTab.Screen name="Orders" component={MyOrders} options={{ title: "My Orders" }} />
      <BuyerTab.Screen name="Profile" component={Profile} />
    </BuyerTab.Navigator>
  );
}

function BuyerApp() {
  return (
    <AppProvider>
      <BuyerStack.Navigator screenOptions={stackOptions}>
        <BuyerStack.Screen name="Tabs" component={BuyerTabs} />
        <BuyerStack.Screen name="CropDetail" component={CropDetail} />
        <BuyerStack.Screen name="FarmerProfile" component={FarmerProfile} />
        <BuyerStack.Screen name="SelectQuantity" component={SelectQuantity} />
        <BuyerStack.Screen name="ReviewRequest" component={ReviewRequest} />
        <BuyerStack.Screen name="RequestSent" component={RequestSent} />
        <BuyerStack.Screen name="RequestDetails" component={RequestDetails} />
        <BuyerStack.Screen name="ConfirmPurchase" component={ConfirmPurchase} />
        <BuyerStack.Screen name="QuantityConfirmed" component={QuantityConfirmed} />
        <BuyerStack.Screen name="BookTruckOrder" component={BookTruckOrder} />
        <BuyerStack.Screen name="ChooseOrder" component={ChooseOrder} />
        <BuyerStack.Screen name="PickupDelivery" component={PickupDelivery} />
        <BuyerStack.Screen name="NearbyTrucks" component={NearbyTrucks} />
        <BuyerStack.Screen name="TruckDetails" component={TruckDetails} />
        <BuyerStack.Screen name="ReviewBooking" component={ReviewBooking} />
        <BuyerStack.Screen name="TrackTruck" component={TrackTruck} />
        <BuyerStack.Screen name="DeliveryCompleted" component={DeliveryCompleted} />
        <BuyerStack.Screen name="Verification" component={Verification} />
        <BuyerStack.Screen name="Help" component={Help} />
        <BuyerStack.Screen name="MyTickets" component={MyTickets} />
        <BuyerStack.Screen name="NewTicket" component={NewTicket} />
        <BuyerStack.Screen name="TicketDetail" component={TicketDetail} />
        <BuyerStack.Screen name="Announcements" component={Announcements} />
      </BuyerStack.Navigator>
    </AppProvider>
  );
}

// ---- Farmer ----------------------------------------------------------------

function FarmerTabs() {
  return (
    <FarmerTab.Navigator
      screenOptions={tabOptions({
        FarmerHome: ["home", "home-outline"],
        Listings: ["leaf", "leaf-outline"],
        Requests: ["mail", "mail-outline"],
        FarmerAccount: ["person", "person-outline"],
      })}
    >
      <FarmerTab.Screen name="FarmerHome" component={FarmerHome} options={{ title: "Home" }} />
      <FarmerTab.Screen name="Listings" component={Listings} options={{ title: "My Crops" }} />
      <FarmerTab.Screen name="Requests" component={FarmerRequests} />
      <FarmerTab.Screen name="FarmerAccount" component={FarmerAccount} options={{ title: "Profile" }} />
    </FarmerTab.Navigator>
  );
}

function FarmerApp() {
  return (
    <FarmerStack.Navigator screenOptions={stackOptions}>
      <FarmerStack.Screen name="FarmerTabs" component={FarmerTabs} />
      <FarmerStack.Screen name="CropForm" component={CropForm} />
      <FarmerStack.Screen name="FarmerRequestDetail" component={FarmerRequestDetail} />
      <FarmerStack.Screen name="Verification" component={Verification} />
      <FarmerStack.Screen name="Help" component={Help} />
      <FarmerStack.Screen name="MyTickets" component={MyTickets} />
      <FarmerStack.Screen name="NewTicket" component={NewTicket} />
      <FarmerStack.Screen name="TicketDetail" component={TicketDetail} />
      <FarmerStack.Screen name="Announcements" component={Announcements} />
      <FarmerStack.Screen name="Demand" component={Demand} />
    </FarmerStack.Navigator>
  );
}

// ---- Driver ----------------------------------------------------------------

function DriverTabs() {
  return (
    <DriverTab.Navigator
      screenOptions={tabOptions({
        Jobs: ["flash", "flash-outline"],
        Trips: ["navigate", "navigate-outline"],
        DriverAccount: ["person", "person-outline"],
      })}
    >
      <DriverTab.Screen name="Jobs" component={DriverJobs} />
      <DriverTab.Screen name="Trips" component={DriverTrips} options={{ title: "My Trips" }} />
      <DriverTab.Screen name="DriverAccount" component={DriverAccount} options={{ title: "Profile" }} />
    </DriverTab.Navigator>
  );
}

function DriverApp() {
  return (
    <DriverStack.Navigator screenOptions={stackOptions}>
      <DriverStack.Screen name="DriverTabs" component={DriverTabs} />
      <DriverStack.Screen name="TripDetail" component={TripDetail} />
      <DriverStack.Screen name="Verification" component={Verification} />
      <DriverStack.Screen name="Help" component={Help} />
      <DriverStack.Screen name="MyTickets" component={MyTickets} />
      <DriverStack.Screen name="NewTicket" component={NewTicket} />
      <DriverStack.Screen name="TicketDetail" component={TicketDetail} />
      <DriverStack.Screen name="Announcements" component={Announcements} />
    </DriverStack.Navigator>
  );
}

// ---- Root ------------------------------------------------------------------

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={stackOptions}>
      <AuthStackNav.Screen name="Login" component={Login} />
      <AuthStackNav.Screen name="ChooseRole" component={ChooseRole} />
      <AuthStackNav.Screen name="CreateAccount" component={CreateAccount} />
    </AuthStackNav.Navigator>
  );
}

function BootSplash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Logo />
      <ActivityIndicator color={colors.forest} />
    </View>
  );
}

export function RootNavigator() {
  const { ready, offline, token, role } = useAuth();

  return (
    <NavigationContainer theme={theme}>
      {!ready ? (
        <BootSplash />
      ) : offline ? (
        // Saved session we couldn't confirm. Not a logout — offer a retry.
        <Reconnect />
      ) : !token ? (
        <AuthStack />
      ) : !servesRole(role) ? (
        // A valid account, but for the other app — or for the web console.
        <WrongApp />
      ) : role === "FARMER" ? (
        <FarmerApp />
      ) : role === "DRIVER" ? (
        <DriverApp />
      ) : (
        <BuyerApp />
      )}
    </NavigationContainer>
  );
}
