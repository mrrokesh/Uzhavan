import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

export type Language = "en" | "ta";

const KEY = "uzhavan.language";

const copy = {
  en: {
    "lang.title": "Choose your language",
    "lang.lead": "This is asked once, the first time the app is opened.",
    "lang.continue": "Continue",
    "tabs.home": "Home",
    "tabs.crops": "My Crops",
    "tabs.requests": "Requests",
    "tabs.profile": "Profile",
    "home.verified": "Verified farmer",
    "home.season": "your farm this season",
    "home.active": "active crops",
    "home.kg": "kg expected",
    "home.add": "Add new crop",
    "home.requests": "New requests",
    "home.confirmed": "Confirmed order",
    "home.expected": "Expected",
    "home.harvests": "Upcoming harvests",
    "home.viewAll": "View all",
    "home.ready": "Ready to ship",
    "home.upcoming": "Upcoming harvest",
    "home.interestedOne": "buyer is interested in your crops",
    "home.interestedMany": "buyers are interested in your crops",
    "notes.title": "Notifications",
    "notes.emptyTitle": "No notifications yet",
    "notes.empty": "Requests, orders and deliveries show up here.",
    "notes.announcements": "Announcements from Uzhavan",
    "notes.markAll": "Mark all read",
    "notes.now": "now",
    "profile.title": "Profile",
    "profile.edit": "Edit profile",
    "profile.active": "Active crops",
    "profile.orders": "Completed orders",
    "profile.rating": "Buyer rating",
    "profile.farm": "Farm details",
    "profile.cropsEmpty": "Crops you list",
    "profile.docs": "My farm & documents",
    "profile.payments": "Payment details",
    "profile.notifications": "Notifications",
    "profile.language": "Language",
    "profile.fingerprint": "Fingerprint login",
    "profile.fingerprintOn": "On. Uzhavan asks for your fingerprint when it opens.",
    "profile.fingerprintOff": "Off. Turn this on to unlock the app with your fingerprint.",
    "profile.help": "Help & support",
    "profile.logout": "Log out",
    "profile.languageName": "English",
    "login.welcome": "Welcome back",
    "login.lead": "Sell your harvest, or haul it, across Tamil Nadu.",
    "login.email": "Email",
    "login.password": "Password",
    "login.signIn": "Sign in",
    "login.forgot": "Forgot your password?",
    "login.new": "New here?",
    "login.create": "Create an account",
    "login.missing": "Enter your email and password",
    "lock.title": "Unlock Uzhavan",
    "lock.body": "Use your fingerprint to continue.",
    "lock.button": "Use fingerprint",
    "lock.password": "Sign in with password",
    "lock.failed": "Fingerprint was not recognised. Try again.",
    "lock.enableTitle": "Fingerprint login",
    "lock.enableBody": "Next time, your fingerprint opens the app. Your password still protects the account.",
    "lock.enable": "Turn on fingerprint",
    "lock.later": "Not now",
    "crop.required": "Fields marked with * are required.",
    "crop.add": "Add crop",
    "crop.harvest": "Harvest & quantity",
    "crop.publish": "Add photos & publish",
    "crop.continue": "Continue",
    "crop.publishButton": "Publish crop",
    "crop.save": "Save changes",
    "crop.draft": "Save as draft",
    "crop.what": "What are you growing?",
    "crop.name": "Crop",
    "crop.category": "Category",
    "crop.variety": "Variety",
    "crop.method": "Farming method",
    "crop.area": "Farm area (acres)",
    "crop.date": "Expected harvest date",
    "crop.grade": "Quality grade",
    "crop.qty": "Expected quantity (kg)",
    "crop.min": "Minimum buyer quantity (kg)",
    "crop.price": "Expected price per kg (₹)",
    "crop.priceHint": "You can confirm the final price when reviewing a buyer request.",
    "crop.availability": "Availability",
    "crop.pre": "Pre-harvest booking",
    "crop.preSub": "Buyers can request before harvest.",
    "crop.ready": "Ready to ship",
    "crop.readySub": "Buyers can request after harvest.",
    "crop.media": "Farm media",
    "crop.addMedia": "Add media",
    "crop.description": "Description",
    "crop.confirm": "I confirm these crop details are accurate.",
  },
  ta: {
    "lang.title": "மொழியைத் தேர்ந்தெடுக்கவும்",
    "lang.lead": "செயலியை முதல் முறை திறக்கும்போது இது ஒருமுறை மட்டும் கேட்கப்படும்.",
    "lang.continue": "தொடரவும்",
    "tabs.home": "முகப்பு",
    "tabs.crops": "என் பயிர்கள்",
    "tabs.requests": "கோரிக்கைகள்",
    "tabs.profile": "சுயவிவரம்",
    "home.verified": "சரிபார்க்கப்பட்ட விவசாயி",
    "home.season": "இந்தப் பருவ பண்ணை",
    "home.active": "செயலில் உள்ள பயிர்கள்",
    "home.kg": "எதிர்பார்க்கும் கிலோ",
    "home.add": "புதிய பயிர் சேர்",
    "home.requests": "புதிய கோரிக்கைகள்",
    "home.confirmed": "உறுதி செய்யப்பட்ட ஆர்டர்",
    "home.expected": "எதிர்பார்ப்பு",
    "home.harvests": "வரவிருக்கும் அறுவடை",
    "home.viewAll": "அனைத்தும்",
    "home.ready": "அனுப்பத் தயார்",
    "home.upcoming": "வரவிருக்கும் அறுவடை",
    "home.interestedOne": "வாங்குபவர் உங்கள் பயிர்களில் ஆர்வம் காட்டுகிறார்",
    "home.interestedMany": "வாங்குபவர்கள் உங்கள் பயிர்களில் ஆர்வம் காட்டுகிறார்கள்",
    "notes.title": "அறிவிப்புகள்",
    "notes.emptyTitle": "இன்னும் அறிவிப்பு இல்லை",
    "notes.empty": "கோரிக்கை, ஆர்டர், டெலிவரி — உங்கள் செயல்பாடு இங்கே வரும்.",
    "notes.announcements": "உழவன் அறிவிப்புகள்",
    "notes.markAll": "அனைத்தும் படித்தது",
    "notes.now": "இப்போது",
    "profile.title": "சுயவிவரம்",
    "profile.edit": "சுயவிவரத்தைத் திருத்து",
    "profile.active": "செயலில் உள்ள பயிர்கள்",
    "profile.orders": "முடிந்த ஆர்டர்கள்",
    "profile.rating": "வாங்குபவர் மதிப்பு",
    "profile.farm": "பண்ணை விவரம்",
    "profile.cropsEmpty": "நீங்கள் பட்டியலிடும் பயிர்கள்",
    "profile.docs": "என் பண்ணையும் ஆவணங்களும்",
    "profile.payments": "பணம் பெறும் விவரம்",
    "profile.notifications": "அறிவிப்புகள்",
    "profile.language": "மொழி",
    "profile.fingerprint": "கைரேகை உள்நுழைவு",
    "profile.fingerprintOn": "இயக்கத்தில் உள்ளது. செயலி திறக்கும்போது கைரேகை கேட்கப்படும்.",
    "profile.fingerprintOff": "அணைந்துள்ளது. செயலியைக் கைரேகையால் திறக்க இதை இயக்கவும்.",
    "profile.help": "உதவியும் ஆதரவும்",
    "profile.logout": "வெளியேறு",
    "profile.languageName": "தமிழ்",
    "login.welcome": "மீண்டும் வருக",
    "login.lead": "தமிழ்நாடு முழுவதும் உங்கள் அறுவடையை விற்கலாம், அல்லது எடுத்துச் செல்லலாம்.",
    "login.email": "மின்னஞ்சல்",
    "login.password": "கடவுச்சொல்",
    "login.signIn": "உள்நுழை",
    "login.forgot": "கடவுச்சொல் மறந்துவிட்டதா?",
    "login.new": "புதியவரா?",
    "login.create": "கணக்கு உருவாக்கவும்",
    "login.missing": "மின்னஞ்சலையும் கடவுச்சொல்லையும் உள்ளிடவும்",
    "lock.title": "உழவனைத் திறக்கவும்",
    "lock.body": "தொடர கைரேகையைப் பயன்படுத்தவும்.",
    "lock.button": "கைரேகை",
    "lock.password": "கடவுச்சொல்லுடன் உள்நுழை",
    "lock.failed": "கைரேகை பொருந்தவில்லை. மீண்டும் முயலவும்.",
    "lock.enableTitle": "கைரேகை உள்நுழைவு",
    "lock.enableBody": "அடுத்த முறை கைரேகை செயலியைத் திறக்கும். கணக்கைக் கடவுச்சொல் பாதுகாக்கும்.",
    "lock.enable": "கைரேகையை இயக்கு",
    "lock.later": "இப்போது வேண்டாம்",
    "crop.required": "* குறி உள்ள இடங்கள் கட்டாயம்.",
    "crop.add": "பயிர் சேர்",
    "crop.harvest": "அறுவடையும் அளவும்",
    "crop.publish": "படங்களும் வெளியீடும்",
    "crop.continue": "தொடரவும்",
    "crop.publishButton": "பயிரை வெளியிடு",
    "crop.save": "மாற்றங்களைச் சேமி",
    "crop.draft": "வரைவாகச் சேமி",
    "crop.what": "என்ன பயிரிடுகிறீர்கள்?",
    "crop.name": "பயிர்",
    "crop.category": "வகை",
    "crop.variety": "ரகம்",
    "crop.method": "விவசாய முறை",
    "crop.area": "பண்ணை பரப்பு (ஏக்கர்)",
    "crop.date": "எதிர்பார்க்கும் அறுவடை தேதி",
    "crop.grade": "தர வகை",
    "crop.qty": "எதிர்பார்க்கும் அளவு (கிலோ)",
    "crop.min": "குறைந்தபட்ச ஆர்டர் (கிலோ)",
    "crop.price": "கிலோ விலை (₹)",
    "crop.priceHint": "வாங்குபவர் கோரிக்கையைப் பார்க்கும்போது இறுதி விலையை உறுதி செய்யலாம்.",
    "crop.availability": "கிடைக்கும் நிலை",
    "crop.pre": "அறுவடைக்கு முன் முன்பதிவு",
    "crop.preSub": "அறுவடைக்கு முன் வாங்குபவர் கோரலாம்.",
    "crop.ready": "அனுப்பத் தயார்",
    "crop.readySub": "அறுவடைக்குப் பின் வாங்குபவர் கோரலாம்.",
    "crop.media": "பண்ணை படங்கள்",
    "crop.addMedia": "படம் சேர்",
    "crop.description": "விவரம்",
    "crop.confirm": "இந்தப் பயிர் விவரம் சரி என்று உறுதி செய்கிறேன்.",
  },
} as const;

export type CopyKey = keyof (typeof copy)["en"];

type I18nState = {
  ready: boolean;
  language: Language | null;
  t: (key: CopyKey) => string;
  setLanguage: (language: Language) => Promise<void>;
};

const I18nContext = createContext<I18nState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [language, setLanguageState] = useState<Language | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (saved === "en" || saved === "ta") setLanguageState(saved);
      })
      .finally(() => setReady(true));
  }, []);

  const setLanguage = async (next: Language) => {
    await SecureStore.setItemAsync(KEY, next);
    setLanguageState(next);
  };

  const value = useMemo<I18nState>(
    () => ({
      ready,
      language,
      t: (key) => copy[language ?? "en"][key],
      setLanguage,
    }),
    [ready, language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside LanguageProvider");
  return ctx;
}
