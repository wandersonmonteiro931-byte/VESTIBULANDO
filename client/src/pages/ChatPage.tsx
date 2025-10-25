import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Settings, Users, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatConversation } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ChatWindow from "../components/ChatWindow";
import NewChatDialog from "../components/NewChatDialog";
import { cn } from "@/lib/utils";
import { useChatConversations } from "@/hooks/useChatConversations";

export default function ChatPage() {
  const { userData } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"chats" | "groups" | "settings">("chats");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);

  const { conversations, isLoading } = useChatConversations();

  const handleConversationCreated = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
    }
  };

  const filteredConversations = conversations?.filter((conv) => {
    const otherParticipantName =
      conv.participante1Id === userData?.uid
        ? conv.participante2Nome
        : conv.participante1Nome;
    return otherParticipantName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getOtherParticipant = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return {
        id: conversation.participante2Id,
        nome: conversation.participante2Nome,
        tipo: conversation.participante2Tipo,
      };
    }
    return {
      id: conversation.participante1Id,
      nome: conversation.participante1Nome,
      tipo: conversation.participante1Tipo,
    };
  };

  const getUnreadCount = (conversation: ChatConversation) => {
    if (conversation.participante1Id === userData?.uid) {
      return conversation.mensagensNaoLidas1;
    }
    return conversation.mensagensNaoLidas2;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        addSuffix: false,
        locale: ptBR,
      });
    } catch {
      return "";
    }
  };

  if (!userData) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar - Lista de Conversas */}
      <div
        className={cn(
          "flex flex-col border-r border-border bg-background transition-all",
          selectedConversation ? "hidden md:flex md:w-[400px]" : "w-full md:w-[400px]"
        )}
      >
        {/* Header */}
        <div className="whatsapp-header flex items-center justify-between p-4">
          <h1 className="text-xl font-semibold text-white" data-testid="text-chat-title">
            EduChat
          </h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => setShowNewChatDialog(true)}
              data-testid="button-new-chat"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => setActiveTab("settings")}
              data-testid="button-settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="whatsapp-search p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar conversa..."
              className="pl-9 bg-white dark:bg-[#2a3942] border-none focus-visible:ring-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-conversation"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-background">
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              activeTab === "chats"
                ? "border-b-2 border-[#00a884] text-[#00a884]"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("chats")}
            data-testid="button-tab-chats"
          >
            Conversas
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              activeTab === "groups"
                ? "border-b-2 border-[#00a884] text-[#00a884]"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("groups")}
            data-testid="button-tab-groups"
          >
            Grupos
          </button>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1 whatsapp-conversation-list">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Carregando...</div>
            </div>
          ) : filteredConversations && filteredConversations.length > 0 ? (
            <div>
              {filteredConversations.map((conversation) => {
                const otherParticipant = getOtherParticipant(conversation);
                const unreadCount = getUnreadCount(conversation);
                const isOnline = false; // TODO: Implementar status online

                return (
                  <div
                    key={conversation.id}
                    className={cn(
                      "whatsapp-conversation-item flex items-center gap-3 p-3 cursor-pointer border-b border-border",
                      selectedConversation?.id === conversation.id &&
                        "bg-[#f0f2f5] dark:bg-[#2a3942]"
                    )}
                    onClick={() => setSelectedConversation(conversation)}
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-[#00a884] text-white">
                          {otherParticipant.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>

                    {/* Conversation Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className="font-semibold text-foreground truncate"
                          data-testid={`text-participant-name-${conversation.id}`}
                        >
                          {otherParticipant.nome}
                        </h3>
                        {conversation.ultimaMensagemTimestamp && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(conversation.ultimaMensagemTimestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.ultimaMensagem || "Sem mensagens"}
                        </p>
                        {unreadCount > 0 && (
                          <Badge
                            className="bg-[#25d366] text-white hover:bg-[#25d366] min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5"
                            data-testid={`badge-unread-${conversation.id}`}
                          >
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
              <p className="text-sm text-muted-foreground mt-2">
                Inicie uma nova conversa para começar
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            onBack={() => setSelectedConversation(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a]">
            <div className="text-center">
              <MessageSquare className="h-24 w-24 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                EduChat Web
              </h2>
              <p className="text-muted-foreground max-w-md">
                Conecte-se com seus colegas, professores e diretores.
                <br />
                Selecione uma conversa para começar.
              </p>
            </div>
          </div>
        )}
      </div>

      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
