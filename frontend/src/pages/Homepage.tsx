import {
  ArrowRight,
  Play,
  FileText,
  Github,
  Headphones,
  User,
  Bookmark,
  Bot,
  Smartphone,
  BookOpen,
  Compass,
  Code,
  Upload,
  SlidersHorizontal,
  Share2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import quetzalLogo from "@/assets/quetzal-logo.png";
import quetzalHero from "@/assets/quetzal-hero.png";

/* ─── Hero product mock ─── */

const TYPE_FILTERS = [
  "All",
  "Articles",
  "Videos",
  "Repos",
  "Podcasts",
] as const;

const TYPE_ICONS: Record<string, typeof FileText> = {
  article: FileText,
  video: Play,
  repo: Github,
  podcast: Headphones,
};

const MOCK_CARDS = [
  {
    title: "Building RAG Applications with LangChain",
    domain: "youtube.com",
    type: "video",
    tags: ["rag", "langchain"],
  },
  {
    title: "GraphRAG: Unlocking LLM Discovery on Narrative Private Data",
    domain: "microsoft.com",
    type: "article",
    tags: ["knowledge-graph"],
  },
  {
    title: "awesome-llm-agents",
    domain: "github.com",
    type: "repo",
    tags: ["agents", "frameworks"],
  },
  {
    title: "Latent Space Podcast: AI Engineering",
    domain: "podcasts.apple.com",
    type: "podcast",
    tags: ["ai-engineering"],
  },
  {
    title: "Fine-Tuning vs RAG: When to Use Which",
    domain: "huggingface.co",
    type: "article",
    tags: ["rag", "fine-tuning"],
  },
  {
    title: "Multi-Agent Systems in Production",
    domain: "youtube.com",
    type: "video",
    tags: ["agents", "production"],
  },
];

function MockResourceCard({
  title,
  domain,
  type,
  tags,
}: (typeof MOCK_CARDS)[0]) {
  const Icon = TYPE_ICONS[type] || FileText;
  return (
    <div className="rounded-md border border-border bg-background p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5",
            type === "video"
              ? "bg-destructive/10 text-destructive"
              : type === "repo"
                ? "bg-foreground/10 text-foreground"
                : type === "podcast"
                  ? "bg-violet-500/10 text-violet-600"
                  : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="w-3 h-3" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
            {title}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{domain}</p>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroPreview() {
  const [activeFilter, setActiveFilter] = useState(0);
  return (
    <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden w-full max-w-lg">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
        </div>
        <span className="text-[10px] text-muted-foreground ml-2 font-medium">
          ailearninghub.app
        </span>
      </div>
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border">
        {TYPE_FILTERS.map((f, i) => (
          <button
            key={f}
            onClick={() => setActiveFilter(i)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors",
              i === activeFilter
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3">
        {MOCK_CARDS.map((card) => (
          <MockResourceCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}

/* ─── Step illustration mocks ─── */

function ShareSheetMock() {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden w-56 mt-6">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[10px] text-muted-foreground">Share via...</span>
      </div>
      <div className="divide-y divide-border">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Messages</span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2 bg-primary/5">
          <Bookmark className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">
            AI Learning Hub
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Copy Link</span>
        </div>
      </div>
    </div>
  );
}

function FilterMock() {
  const filters = ["Videos", "Podcasts", "Articles", "GitHub"];
  const tags = ["rag", "agents", "tutorial"];
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden w-56 mt-6">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <SlidersHorizontal className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground">
          Filters
        </span>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f, i) => (
            <span
              key={f}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-medium",
                i === 2
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {f}
            </span>
          ))}
        </div>
        <div className="border-t border-border pt-2">
          <span className="text-[10px] text-muted-foreground mb-1.5 block">
            Tags
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-full border border-primary/30 text-primary font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceMock() {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden w-64 mt-6">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">
          GraphRAG Experiment
        </span>
      </div>
      <div className="flex divide-x divide-border">
        {/* Resources side */}
        <div className="w-24 p-2 space-y-1.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
            Linked
          </span>
          {[Play, Github, Headphones, FileText].map((Icon, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Icon
                className={cn(
                  "w-3 h-3",
                  i === 0
                    ? "text-destructive"
                    : i === 1
                      ? "text-foreground"
                      : i === 2
                        ? "text-violet-600"
                        : "text-primary"
                )}
              />
              <div className="h-1.5 rounded-full bg-muted flex-1" />
            </div>
          ))}
        </div>
        {/* Notes side */}
        <div className="flex-1 p-2 space-y-1.5">
          <div className="h-2 rounded-full bg-foreground/15 w-3/4" />
          <div className="h-1.5 rounded-full bg-muted w-full" />
          <div className="h-1.5 rounded-full bg-muted w-5/6" />
          <div className="h-1.5 rounded-full bg-muted w-full" />
          <div className="h-2 rounded-l bg-primary/10 border-l-2 border-primary/40 px-1 mt-1">
            <div className="h-1 rounded-full bg-primary/20 w-full mt-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step number badge ─── */

function StepNumber({ n }: { n: number }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold mb-4">
      {n}
    </div>
  );
}

/* ─── Page ─── */

export default function Homepage() {
  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <img
            src={quetzalLogo}
            alt="AI Learning Hub"
            className="w-9 h-9 object-contain"
            style={{ transform: "scaleX(-1)" }}
          />
          AI Learning Hub
        </span>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-5 text-xs text-muted-foreground">
            <a
              href="#how-it-works"
              className="hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a href="#api" className="hover:text-foreground transition-colors">
              API
            </a>
          </div>
          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="text-xs">
                  Log in
                </Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button size="sm" className="text-xs">
                  Get Started
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link to="/app">
                <Button size="sm" className="text-xs">
                  Open App
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="px-6 md:px-12 pt-20 md:pt-28 pb-20 md:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl">
          <div>
            <h1 className="text-3xl md:text-[2.75rem] font-semibold leading-[1.12] tracking-tight text-foreground">
              Save what you find.
              <br />
              Organize what matters.
              <br />
              <span className="text-primary font-bold">
                Build what you learn.
              </span>
            </h1>
            <div className="mt-6 space-y-4 max-w-lg">
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                You save podcasts, articles, repos, and tutorials all week.
              </p>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                But saving isn&apos;t learning.
              </p>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                AI Learning Hub turns what you collect into projects you
                actually build.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/app">
                <Button size="lg" className="text-sm">
                  Get Started &mdash; Free
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button
                  variant="ghost"
                  size="default"
                  className="text-sm text-muted-foreground"
                >
                  See How It Works <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end relative">
            <img
              src={quetzalHero}
              alt=""
              className="absolute -top-20 -right-12 w-36 h-auto object-contain z-10 pointer-events-none select-none opacity-90 mix-blend-multiply"
              style={{ transform: "scaleX(-1) rotate(-3deg)" }}
            />
            <HeroPreview />
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ─── How it works ─── */}
      <section
        id="how-it-works"
        className="px-6 md:px-12 py-20 md:py-28 bg-background-alt"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Save &rarr; Organize &rarr; Build
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Three steps from scattered bookmarks to real projects.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-x-12 gap-y-16">
            {/* Step 1 */}
            <div>
              <StepNumber n={1} />
              <h3 className="text-base font-semibold text-foreground mb-2">
                Save from anywhere
              </h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                Hear a podcast in the car? Share it to AI Learning Hub from your
                phone. Two taps. We grab the title, detect the content type, and
                file it &mdash; you&apos;re back to your day in under 5 seconds.
              </p>
              <ShareSheetMock />
            </div>
            {/* Step 2 */}
            <div>
              <StepNumber n={2} />
              <h3 className="text-base font-semibold text-foreground mb-2">
                Organize when you&apos;re ready
              </h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                Saturday morning with coffee. Your saves from the week are
                waiting &mdash; titles populated, content types detected. Search
                and smart filters mean you actually find things again.
              </p>
              <FilterMock />
            </div>
            {/* Step 3 */}
            <div>
              <StepNumber n={3} />
              <h3 className="text-base font-semibold text-foreground mb-2">
                Build something real
              </h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                Create a project workspace. Link your saved resources. Paste in
                your Claude conversations and notes. Your project page becomes a
                living notebook &mdash; resources on one side, your thinking in
                the center.
              </p>
              <WorkspaceMock />
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ─── Built for you — and your AI ─── */}
      <section id="api" className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              Built for you &mdash; and your AI.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              AI Learning Hub is an MCP server. That means Claude, ChatGPT, and
              your custom agents can save, search, and organize your knowledge
              &mdash; the same way you do.
            </p>
          </div>

          {/* Flow diagram */}
          <div className="flex items-center justify-center gap-4 md:gap-8 mb-16">
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-14 h-14 rounded-xl border border-border bg-background flex items-center justify-center">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                You
              </span>
            </div>
            <div className="w-16 md:w-24 h-px bg-border" />
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Bookmark className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                AI Learning Hub
              </span>
            </div>
            <div className="w-16 md:w-24 h-px bg-border" />
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-14 h-14 rounded-xl border border-border bg-background flex items-center justify-center">
                <Bot className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                Your AI
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mb-12">
            Same saves. Same projects. Same workspace. Different interfaces.
          </p>

          {/* Two code panels side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* MCP Tool Call */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                <Bot className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  Your AI agent calls a tool
                </span>
              </div>
              <div className="font-mono text-xs text-muted-foreground p-4 leading-relaxed bg-background">
                <p className="text-primary/60 mb-2">{"// MCP tool call"}</p>
                <p>{"{"}</p>
                <p className="pl-3">
                  <span className="text-primary">&quot;tool&quot;</span>:{" "}
                  <span className="text-foreground">
                    &quot;learning_hub.save&quot;
                  </span>
                  ,
                </p>
                <p className="pl-3">
                  <span className="text-primary">&quot;args&quot;</span>: {"{"}
                </p>
                <p className="pl-6">
                  <span className="text-primary">&quot;url&quot;</span>:{" "}
                  <span className="text-foreground">
                    &quot;arxiv.org/abs/2312.10997&quot;
                  </span>
                  ,
                </p>
                <p className="pl-6">
                  <span className="text-primary">&quot;project&quot;</span>:{" "}
                  <span className="text-foreground">
                    &quot;rag-experiment&quot;
                  </span>
                  ,
                </p>
                <p className="pl-6">
                  <span className="text-primary">&quot;note&quot;</span>:{" "}
                  <span className="text-foreground">
                    &quot;Key paper on hybrid retrieval&quot;
                  </span>
                </p>
                <p className="pl-3">{"}"}</p>
                <p>{"}"}</p>
                <p className="mt-3 text-primary/60">
                  {"// → saved, enriched, linked to project"}
                </p>
              </div>
            </div>

            {/* Conversation */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  What that looks like in practice
                </span>
              </div>
              <div className="p-4 space-y-3 bg-background">
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    I found a great paper on hybrid RAG approaches. Can you save
                    it to my project?
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground leading-relaxed">
                      Saved to{" "}
                      <span className="font-medium text-primary">
                        RAG Experiment
                      </span>{" "}
                      and linked with your other retrieval resources.
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        rag
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        arxiv.org
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8 leading-relaxed max-w-lg mx-auto">
            Full MCP server. Full REST API. Your agents don&apos;t need a
            browser &mdash; they need tools. AI Learning Hub is a tool.
          </p>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ─── Who it's for ─── */}
      <section className="px-6 md:px-12 py-20 md:py-28 bg-background-alt">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-12">
            Who it&apos;s for
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Smartphone,
                title: "The Commute Saver",
                desc: "You find things on your phone all day. Articles from LinkedIn, repos from Twitter, podcasts mid-drive. You need them organized later \u2014 not lost in 47 browser tabs.",
              },
              {
                icon: BookOpen,
                title: "The Weekend Builder",
                desc: "You go down rabbit holes. You need a place where your notes, saves, and thinking live together \u2014 a workspace, not a bookmark folder.",
              },
              {
                icon: Compass,
                title: "The Curious Explorer",
                desc: "You\u2019re exploring AI for your field \u2014 engineering, design, research. You want to go from saving to building at your own pace. No pressure.",
              },
              {
                icon: Code,
                title: "The Agent Builder",
                desc: "You want MCP tools and APIs. You\u2019ll wire this into your agents, automations, and LLM workflows. The UI is optional. The platform isn\u2019t.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-lg border border-border bg-background p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-accent-soft flex items-center justify-center mb-4">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">
                  {title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-border" />
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Built for people who build with AI.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Invite-only during early access. Request access or sign in if you
            already have an account.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" className="text-sm">
                  Get Started
                </Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button variant="outline" size="default" className="text-sm">
                  Sign in
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link to="/app">
                <Button size="lg" className="text-sm">
                  Open App
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 md:px-12 py-6 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src={quetzalLogo}
            alt=""
            className="w-5 h-5 object-contain opacity-60"
            style={{ transform: "scaleX(-1)" }}
          />
          AI Learning Hub
        </span>
        <span className="text-xs text-muted-foreground">
          V1 &middot; Invite only
        </span>
      </footer>
    </div>
  );
}
