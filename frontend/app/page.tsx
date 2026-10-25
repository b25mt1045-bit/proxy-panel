import { BriefForm } from "@/components/BriefForm";
import { Compare } from "@/components/Compare";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { Outcome } from "@/components/Outcome";
import { Statement } from "@/components/Statement";
import { Timeline } from "@/components/Timeline";

export default function Home() {
  return (
    <>
      <Hero />
      <Marquee />
      <Timeline />
      <Outcome />
      <Statement />
      <Compare />
      <BriefForm />
    </>
  );
}
