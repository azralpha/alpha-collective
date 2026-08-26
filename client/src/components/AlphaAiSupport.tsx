import { AIChatBox } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Minus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import "./AlphaAiSupport.css";

const QUICK_PROMPTS = ["How do I pay?", "Track my order", "Product recommendations"];
type SupportChatMessage = { role: "user" | "assistant"; content: string };

export default function AlphaAiSupport() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const chat = trpc.support.chat.useMutation();

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || chat.isPending) return;
    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    try {
      const result = await chat.mutateAsync({ messages: nextMessages });
      const recommendationCopy = result.recommendations.length ? `\n\n${result.recommendations.map(item => `• [${item.title}](${item.url}) — ₦${item.price.toLocaleString("en-NG")}`).join("\n")}` : "";
      setMessages(current => [...current, { role: "assistant", content: `${result.reply}${recommendationCopy}` }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Alpha AI Support is temporarily unavailable.";
      setMessages(current => [...current, { role: "assistant", content: message }]);
      toast.error("Alpha AI Support could not respond. Please try again shortly.");
    }
  }

  return <div className="alpha-ai-support" aria-live="polite">
    {open ? <section className="alpha-ai-support-panel" aria-label="Alpha AI Support chat">
      <header><div><span className="alpha-ai-support-icon"><Sparkles size={16} /></span><div><strong>Alpha AI Support</strong><small>Private, Nigerian marketplace help</small></div></div><div className="alpha-ai-support-actions"><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Minimise Alpha AI Support"><Minus size={18} /></Button><Button type="button" variant="ghost" size="icon" onClick={() => { setMessages([]); setOpen(false); }} aria-label="Close and clear Alpha AI Support chat"><X size={18} /></Button></div></header>
      <p className="alpha-ai-support-notice">Do not share card details, PINs, passwords, bank details, or IDs. Order support requires your Alpha Market order reference.</p>
      <AIChatBox messages={messages} onSendMessage={sendMessage} isLoading={chat.isPending} height="min(58vh, 470px)" placeholder="Ask Alpha AI about orders, payments, or products…" emptyStateMessage="How can Alpha AI Support help today?" suggestedPrompts={QUICK_PROMPTS} />
    </section> : null}
    <button type="button" className="alpha-ai-support-launcher" onClick={() => setOpen(true)} aria-label="Open Alpha AI Support" title="Alpha AI Support"><MessageCircle size={20} /><span>Alpha AI Support</span><Sparkles size={14} /></button>
  </div>;
}
