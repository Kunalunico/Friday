
import { useState, useEffect } from 'react';
import { Settings, Plus, MessageSquare, Trash, Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from "@/hooks/use-toast";

type Message = {
  role: 'user' | 'assistant';
  content: string;
  isNew?: boolean;
  isThinking?: boolean;
  timestamp: Date;
  id: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  document?: File | null;
};

export const Sidebar = ({
  onClearAll,
  conversations,
  setConversations,
  onSelectConversation,
  currentConversationId
}: {
  onClearAll: () => void;
  conversations: Conversation[];
  setConversations: (convs: Conversation[]) => void;
  onSelectConversation: (id: string) => void;
  currentConversationId: string | null;
}) => {
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Preload the logo image
  useEffect(() => {
    const img = new Image();
    img.src = "image.png";
    img.onload = () => setLogoLoaded(true);
  }, []);

  const createNewChat = () => {
    const newChat = {
      id: Date.now().toString(),
      title: `Chat ${conversations.length + 1}`,
      messages: [],
    };

    setConversations([newChat, ...conversations]);
    onSelectConversation(newChat.id);

    toast({
      description: "New chat created",
    });
  };

  const handleClearAll = () => {
    setConversations([]);
    onClearAll();
    toast({
      description: "All conversations cleared",
    });
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-1/4 min-w-[250px]'} h-screen bg-muted border-r border-gray-800 flex flex-col rounded-r-xl transition-all duration-300 ease-in-out overflow-hidden`}>
      <div className="p-4 border-b border-gray-800 rounded-tr-xl flex items-center justify-between min-h-[72px]">
        <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <div className="h-12 flex items-center">
            {logoLoaded ? (
              <img
                src="/lovable-uploads/f5e7e9ce-ecac-466e-92ff-4aa29dde2032.png"
                alt="Unico Connect Logo"
                className="h-12 transition-opacity duration-200"
              />
            ) : (
              <div className="h-12 w-32 bg-gray-800 rounded animate-pulse" />
            )}
          </div>
        </div>
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="sm"
          className="text-foreground hover:bg-gray-800 rounded-lg p-2 shrink-0"
        >
          {isCollapsed ? <Menu size={20} /> : <X size={20} />}
        </Button>
      </div>

      <div className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="p-4">
          <Button
            onClick={createNewChat}
            className="w-full flex items-center gap-2 bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(63,128,255,0.3)] rounded-xl"
          >
            <Plus size={16} />
            New chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm text-secondary">Your conversations</h2>
            {conversations.length > 0 && (
              <Button
                onClick={handleClearAll}
                variant="ghost"
                size="sm"
                className="text-destructive p-0 hover:bg-transparent hover:text-destructive rounded-lg"
              >
                <Trash size={16} />
                <span className="ml-2">Clear all</span>
              </Button>
            )}
          </div>

          {conversations.length > 0 ? (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-3 rounded-xl cursor-pointer mb-1 flex items-center gap-2 ${currentConversationId === conv.id ? 'bg-gray-800' : 'hover:bg-gray-800'
                  }`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <MessageSquare size={16} className="text-primary" />
                <span className="text-sm text-foreground truncate">{conv.title}</span>
              </div>
            ))
          ) : (
            <div className="text-center text-sm text-secondary mt-4 p-4 bg-gray-800/50 rounded-xl">
              No conversations yet
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 rounded-br-xl">
          <Button
            variant="ghost"
            className="w-full flex items-center gap-2 text-secondary hover:text-primary hover:bg-gray-800/50 rounded-xl"
          >
            <Settings size={16} />
            <span>Settings</span>
          </Button>
        </div>
      </div>

      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-4 gap-4">
          <Button
            onClick={createNewChat}
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0 hover:bg-gray-800 rounded-lg"
            title="New chat"
          >
            <Plus size={20} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0 hover:bg-gray-800 rounded-lg"
            title="Settings"
          >
            <Settings size={20} />
          </Button>
        </div>
      )}
    </div>
  );
};
