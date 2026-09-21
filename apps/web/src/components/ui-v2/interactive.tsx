"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Bot, Command, Send, Sparkles } from "lucide-react";
import styles from "./ui-v2.module.css";

export function CashPresence({
  status = "Ready when you are",
}: {
  status?: string;
}) {
  return (
    <figure className={styles.presence}>
      <img src="/assets/gremlin-v3-crop.png" alt="Cash, the Cashpile gremlin" />
      <figcaption>
        <strong>Cash</strong>
        <span>{status}</span>
      </figcaption>
    </figure>
  );
}

export function CashPrompt({
  placeholder = "Tell Cash what you need…",
  suggestions = [],
  onSubmit,
}: {
  placeholder?: string;
  suggestions?: string[];
  onSubmit?: (prompt: string) => void;
}) {
  const [value, setValue] = React.useState("");
  const inputId = React.useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const prompt = value.trim();
    if (!prompt) return;
    onSubmit?.(prompt);
    setValue("");
  }

  return (
    <section className={styles.prompt} aria-labelledby={`${inputId}-title`}>
      <div className={styles.promptHero}>
        <CashPresence />
        <h2 id={`${inputId}-title`}>What are we doing today?</h2>
      </div>
      <form className={styles.promptForm} onSubmit={submit}>
        <Sparkles aria-hidden="true" size={20} />
        <label className={styles.srOnly} htmlFor={inputId}>
          Ask Cash
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
        />
        <button type="submit" aria-label="Send to Cash">
          <Send size={17} />
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSubmit?.(suggestion)}
            >
              {suggestion}
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ContextualCashTrigger({
  label = "Ask Cash",
  prompt,
  href,
  onTrigger,
}: {
  label?: string;
  prompt?: string;
  href?: string;
  onTrigger?: (prompt?: string) => void;
}) {
  const content = (
    <>
      <Bot size={17} aria-hidden="true" />
      {label}
      <Command size={14} aria-hidden="true" />
    </>
  );
  if (href)
    return (
      <Link className={styles.cashTrigger} href={href}>
        {content}
      </Link>
    );
  return (
    <button
      className={styles.cashTrigger}
      type="button"
      onClick={() => onTrigger?.(prompt)}
    >
      {content}
    </button>
  );
}
