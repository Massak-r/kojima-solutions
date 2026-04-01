import HeroSectionV3 from "@/components/v3/HeroSectionV3";
import MethodologySection from "@/components/MethodologySection";
import ServicesSectionV3 from "@/components/v3/ServicesSectionV3";
import CreditsSectionV3 from "@/components/v3/CreditsSectionV3";
import FAQSection from "@/components/FAQSection";
import ContactSectionV3 from "@/components/v3/ContactSectionV3";
import Footer from "@/components/Footer";
import FloatingCTA from "@/components/FloatingCTA";
import SectionDivider from "@/components/SectionDivider";

const Index = () => (
  <>
    <main>
      <HeroSectionV3 />
      <SectionDivider />
      <MethodologySection />
      <SectionDivider />
      <ServicesSectionV3 />
      <SectionDivider />
      <CreditsSectionV3 />
      <SectionDivider />
      <FAQSection />
      <SectionDivider />
      <ContactSectionV3 />
    </main>
    <Footer />
    <FloatingCTA />
  </>
);

export default Index;
