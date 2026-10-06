// The web app's icon names (web/src/lib/icons.tsx), drawn with lucide-react-native.
import {
  ArrowDownRight, ArrowUpRight, Award, BarChart3, Search, Users, Baby, Banknote, Beer, Bike, Bitcoin, Book, Briefcase, Building, Bus, Cake,
  Calendar, CalendarDays, Camera, Car, Cat, CircleDashed, Clapperboard, Coffee, Coins, CreditCard, Crown, Dog,
  Droplet, Dumbbell, Flame, Flower2, Fuel, Gamepad2, Gauge, Gem, Gift, Glasses, GraduationCap, HandCoins, HandHeart,
  Heart, HeartPulse, Home, Landmark, Laptop, Leaf, Lightbulb, Music, Palette, PartyPopper, PawPrint, Percent,
  PiggyBank, Pill, Pizza, Plane, Receipt, Repeat, Rocket, Scissors, Shield, Shirt, ShoppingBag, ShoppingCart, Smartphone,
  Sofa, Sparkles, Star, Stethoscope, Store, Sun, Tag, Target, Ticket, TrainFront, TreePalm, TrendingDown, TrendingUp,
  TriangleAlert, Tv, Umbrella, Undo2, Utensils, Wallet, WalletCards, Watch, Wifi, Wine, Wrench, Zap,
  type LucideIcon, type LucideProps,
} from 'lucide-react-native';

export const ICONS: Record<string, LucideIcon> = {
  'arrow-down-right': ArrowDownRight, 'bar-chart': BarChart3, search: Search, users: Users, 'arrow-up-right': ArrowUpRight, award: Award, baby: Baby, banknote: Banknote,
  beer: Beer, bike: Bike, bitcoin: Bitcoin, book: Book, briefcase: Briefcase, building: Building, bus: Bus, cake: Cake,
  calendar: Calendar, 'calendar-days': CalendarDays, camera: Camera, car: Car, cat: Cat, 'circle-dashed': CircleDashed,
  clapperboard: Clapperboard, coffee: Coffee, coins: Coins, 'credit-card': CreditCard, crown: Crown, dog: Dog,
  droplet: Droplet, dumbbell: Dumbbell, flame: Flame, flower: Flower2, fuel: Fuel, 'gamepad-2': Gamepad2, gauge: Gauge,
  gem: Gem, gift: Gift, glasses: Glasses, 'graduation-cap': GraduationCap, 'hand-coins': HandCoins, 'hand-heart': HandHeart,
  heart: Heart, 'heart-pulse': HeartPulse, home: Home, landmark: Landmark, laptop: Laptop, leaf: Leaf, lightbulb: Lightbulb,
  music: Music, palette: Palette, 'party-popper': PartyPopper, 'paw-print': PawPrint, percent: Percent,
  'piggy-bank': PiggyBank, pill: Pill, pizza: Pizza, plane: Plane, receipt: Receipt, repeat: Repeat, rocket: Rocket,
  scissors: Scissors, shield: Shield, shirt: Shirt, 'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart,
  smartphone: Smartphone, sofa: Sofa, sparkles: Sparkles, star: Star, stethoscope: Stethoscope, store: Store, sun: Sun,
  tag: Tag, target: Target, ticket: Ticket, train: TrainFront, 'tree-palm': TreePalm, 'trending-down': TrendingDown,
  'trending-up': TrendingUp, 'alert-triangle': TriangleAlert, tv: Tv, umbrella: Umbrella, 'undo-2': Undo2,
  utensils: Utensils, wallet: Wallet, 'wallet-cards': WalletCards, watch: Watch, wifi: Wifi, wine: Wine, wrench: Wrench,
  zap: Zap,
};

/** Icons offered when creating a custom category. */

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = ICONS[name] ?? Tag;
  return <C {...props} />;
}
