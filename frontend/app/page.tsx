import { BriefForm } from "@/components/BriefForm";
import { Hero } from "@/components/Hero";
import { Steps } from "@/components/Steps";
import { Story } from "@/components/Story";

export default function Home() {
  return (
    <>
      <Hero />
      <Story />
      <Steps />
      <BriefForm />
    </>
  );
}
