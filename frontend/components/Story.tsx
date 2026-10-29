const BEFORE = "Surveys tell you what people say. Focus groups take weeks and cost thousands. Proxy Panel starts from";
const MARKED = "what real people actually like:";
const AFTER =
  "the brands, shows and music they over-index on. It turns that into six shoppers who argue about your product, so you hear the objections before you spend a cent on launch.";

const words = (s: string) =>
  s.split(" ").map((w, i) => (
    <span key={i} className="read-word">
      {w}{" "}
    </span>
  ));

/** A big paragraph that reads itself in as it scrolls up, with a highlight that sweeps over the key phrase. */
export function Story() {
  return (
    <section className="px-3 py-8 sm:px-4">
      <div className="mx-auto max-w-7xl rounded-[48px] bg-[#e9eeee] px-6 py-20 sm:rounded-[80px] sm:px-12 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <h2 className="reveal text-center font-serif text-[clamp(2.2rem,5.4vw,4.4rem)] leading-[1.02] tracking-[-0.025em]">
            To a launch,
            <br />
            the first buyer is <span className="text-pop">everything</span>
          </h2>
          <p className="mt-12 text-justify text-[clamp(1.4rem,2.7vw,2.3rem)] leading-[1.32] tracking-[-0.01em] [text-wrap:pretty]">
            {words(BEFORE)}
            <mark className="mark text-inherit">{words(MARKED)}</mark>{" "}
            {words(AFTER)}
          </p>
        </div>
      </div>
    </section>
  );
}
