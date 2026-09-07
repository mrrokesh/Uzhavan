import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PhoneShell } from "./components/Chrome";
import { AppProvider } from "./context/AppContext";
import { RequestUpdate, ConfirmPurchase, QuantityConfirmed, BookTruckOrder } from "./screens/AcceptFlow";
import { CropDetail } from "./screens/CropDetail";
import { HomeFeed } from "./screens/HomeFeed";
import { MyOrders, Profile } from "./screens/OrdersProfile";
import { ReviewRequest, RequestDetails, RequestSent, SelectQuantity } from "./screens/RequestFlow";
import {
  DeliveryCompleted,
  FindingTruck,
  ReviewBooking,
  TrackTruck,
  TruckConfirmed,
} from "./screens/TripFlow";
import { BookTrackHome, ChooseOrder, NearbyTrucks, PickupDelivery, TruckDetails } from "./screens/TruckFlow";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <PhoneShell>
          <div className="h-full">
          <Routes>
            <Route path="/" element={<HomeFeed />} />
            <Route path="/crop/:id" element={<CropDetail />} />
            <Route path="/crop/:id/quantity" element={<SelectQuantity />} />
            <Route path="/crop/:id/review" element={<ReviewRequest />} />
            <Route path="/request/:id/sent" element={<RequestSent />} />
            <Route path="/request/:id" element={<RequestDetails />} />
            <Route path="/request/:id/update" element={<RequestUpdate />} />
            <Route path="/request/:id/confirm" element={<ConfirmPurchase />} />
            <Route path="/order/:id/confirmed" element={<QuantityConfirmed />} />
            <Route path="/order/:id/book-truck" element={<BookTruckOrder />} />
            <Route path="/book-track" element={<BookTrackHome />} />
            <Route path="/book-track/choose-order" element={<ChooseOrder />} />
            <Route path="/book-track/pickup" element={<PickupDelivery />} />
            <Route path="/book-track/trucks" element={<NearbyTrucks />} />
            <Route path="/book-track/truck/:id" element={<TruckDetails />} />
            <Route path="/booking/review" element={<ReviewBooking />} />
            <Route path="/booking/finding" element={<FindingTruck />} />
            <Route path="/booking/confirmed" element={<TruckConfirmed />} />
            <Route path="/booking/track" element={<TrackTruck />} />
            <Route path="/booking/delivered" element={<DeliveryCompleted />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </PhoneShell>
      </BrowserRouter>
    </AppProvider>
  );
}
