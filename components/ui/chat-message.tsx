import { cn } from "@/lib/utils";
import Image from "next/image";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { type VariantProps, cva } from "class-variance-authority";
import { SparklesIcon, UserIcon } from "lucide-react";
import React, { type ReactNode } from "react";
import { UserCircle } from "@mynaui/icons-react";


const chatMessageVariants = cva("flex gap-4 w-full", {
	variants: {
		variant: {
			default: "",
			bubble: "",
			full: "p-5",
		},
		type: {
			incoming: "justify-start mr-auto",
			outgoing: "justify-end ml-auto",
		},
	},
	compoundVariants: [
		{
			variant: "full",
			type: "outgoing",
			className: "bg-slate-100 dark:bg-slate-800",
		},
		{
			variant: "full",
			type: "incoming",
			className: "bg-white dark:bg-slate-950",
		},
	],
	defaultVariants: {
		variant: "default",
		type: "incoming",
	},
});

interface MessageContextValue extends VariantProps<typeof chatMessageVariants> {
	id: string;
}

const ChatMessageContext = React.createContext<MessageContextValue | null>(
	null,
);

const useChatMessage = () => {
	const context = React.useContext(ChatMessageContext);
	return context;
};

// Root component
interface ChatMessageProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof chatMessageVariants> {
	children?: React.ReactNode;
	id: string;
}

const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(
	(
		{
			className,
			variant = "default",
			type = "incoming",
			id,
			children,
			...props
		},
		ref,
	) => {
		return (
			<ChatMessageContext.Provider value={{ variant, type, id }}>
				<div
					ref={ref}
					className={cn(chatMessageVariants({ variant, type, className }))}
					{...props}
				>
					{children}
				</div>
			</ChatMessageContext.Provider>
		);
	},
);
ChatMessage.displayName = "ChatMessage";

// Avatar component

const chatMessageAvatarVariants = cva(
	" flex items-center w-5 h-5 aspect-square rounded-full justify-center align-center my-auto py-auto chat-bubble border border-rose-50 overflow-hidden",
	{
		variants: {
			type: {
				incoming: "ring-slate-200 dark:ring-slate-800",
				outgoing: "ring-slate-500/30 dark:ring-slate-400/30",
				self: "chat-bubble-blue",
			},
		},
		defaultVariants: {
			type: "incoming",
		},
	},
);

interface ChatMessageAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
	imageSrc?: string;
	icon?: ReactNode;
	variant?: "incoming" | "outgoing" | "self";
}

const ChatMessageAvatar = React.forwardRef<
	HTMLDivElement,
	ChatMessageAvatarProps
>(({ className, icon: iconProps, imageSrc, variant, ...props }, ref) => {
	const context = useChatMessage();
	const type = variant ?? context?.type ?? "incoming";
	const icon =
		iconProps ?? (type === "incoming" ? <UserCircle /> : <UserCircle />);
	return (
		<div
			ref={ref}
			className={cn(chatMessageAvatarVariants({ type, className }))}
			{...props}
		>
			{imageSrc ? (
				<Image src={imageSrc} alt="Avatar" 
				width={0} height={0} sizes="30vw"  
				className="object-fill w-full h-fit  aspect-square rounded-full bg-white/20 " />
			) : (
				<div className="translate-y-px [&_svg]:size-4 [&_svg]:shrink-0">
					{icon}
				</div>
			)}
		</div>
	);
});
ChatMessageAvatar.displayName = "ChatMessageAvatar";

// Content component

const chatMessageContentVariants = cva("flex flex-col gap-2 ", {
	variants: {
		variant: {
			default: "",
			bubble: "rounded-xl px-2 py-0 ",
			full: "",
		},
		type: {
			incoming: "",
			outgoing: "",
		},
	},
	compoundVariants: [
		{
			variant: "bubble",
			type: "incoming",
			className: "bg-sky-50/60 backdrop-blur-md rounded-lg pl-2 pr-2  h-fit align-center my-auto py-1 tracking-wide max-w-[62%] bg-opacity-70 chat-bubble-blue outline-transparent text-sm text-slate-950 dark:bg-slate-50 dark:text-slate-900",
		},
		{
			variant: "bubble",
			type: "outgoing",
			className: "bg-rose-50/60 backdrop-blur-md rounded-lg pl-2 pr-2 leading-tight h-fit  align-center my-auto py-1   tracking-wide max-w-[62%] bg-opacity-70  chat-bubble outline-transparent text-sm text-slate-950 dark:bg-slate-50 dark:text-slate-900",
		},
	],
	defaultVariants: {
		variant: "default",
		type: "incoming",
	},
});

interface ChatMessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
	id?: string;
	content: string;
}

const ChatMessageContent = React.forwardRef<
	HTMLDivElement,
	ChatMessageContentProps
>(({ className, content, id: idProp, children, ...props }, ref) => {
	const context = useChatMessage();

	const variant = context?.variant ?? "default";
	const type = context?.type ?? "incoming";
	const id = idProp ?? context?.id ?? "";

	return (
		<div
			ref={ref}
			className={cn(chatMessageContentVariants({ variant, type, className }))}
			{...props}
		>
			{content.length > 0 && <MarkdownContent id={id} content={content} />}
			{children}
		</div>
	);
});
ChatMessageContent.displayName = "ChatMessageContent";

export { ChatMessage, ChatMessageAvatar, ChatMessageContent };
