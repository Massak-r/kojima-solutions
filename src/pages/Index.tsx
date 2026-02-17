import { LanguageProvider } from "@/hooks/useLanguage";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import MethodologySection from "@/components/MethodologySection";
import ServicesSection from "@/components/ServicesSection";
import CreditsSection from "@/components/CreditsSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

const Index = () => (
  <LanguageProvider>
    <Header />
    <main>
      <HeroSection />
      <MethodologySection />
      <ServicesSection />
      <CreditsSection />
      <ContactSection />
    </main>
    <Footer />
  </LanguageProvider>
);

export default Index;
