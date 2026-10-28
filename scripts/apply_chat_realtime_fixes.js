const fs = require('fs');

// 1. Update CustomerChatClient.tsx
const customerPath = 'src/app/(customer)/chat/CustomerChatClient.tsx';
let custContent = fs.readFileSync(customerPath, 'utf8');

const custOldRegex = /\/\/ Connect to Supabase Realtime private channel for the conversation[\s\S]*?return \(\) => \{\s*supabase\.removeChannel\(channel\);\s*\};/m;

const custNewEffect = `// Connect to Supabase Realtime via postgres_changes and broadcast for instant live delivery
  useEffect(() => {
    if (!conversation?.id) {
      return;
    }

    const supabase = createClient();
    const convId = conversation.id;
    const topic = \`chat:\${convId}\`;

    const channel = supabase.channel(topic);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: \`conversation_id=eq.\${convId}\`,
        },
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            conversation_id: string;
            body: string;
            message_type: string;
            created_at: string;
            sender_id: string;
          };
          if (!newMsg || !newMsg.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            const isSelf = newMsg.sender_id === currentUserId;
            const formattedMsg: ChatMessage = {
              id: newMsg.id,
              conversation_id: newMsg.conversation_id,
              body: newMsg.body,
              message_type: newMsg.message_type,
              created_at: newMsg.created_at,
              is_self: isSelf,
              sender_name: isSelf ? 'You' : 'Support Team',
              sender_role: isSelf ? 'customer' : 'staff',
              status: 'sent',
            };

            const pendingIndex = prev.findIndex(
              (m) => m.status === 'pending' && m.body === newMsg.body && isSelf
            );
            if (pendingIndex !== -1) {
              const updated = [...prev];
              updated[pendingIndex] = formattedMsg;
              return updated;
            }

            return [...prev, formattedMsg];
          });
        }
      )
      .on(
        'broadcast',
        { event: 'new_message' },
        (response: {
          payload: {
            id: string;
            conversation_id: string;
            body: string;
            message_type: string;
            created_at: string;
            sender_id?: string;
            sender_role: string;
            sender_name?: string;
          };
        }) => {
          const newMsg = response.payload;
          if (!newMsg || !newMsg.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            const isSelf = newMsg.sender_id === currentUserId;
            const isStaff = newMsg.sender_role === 'admin' || newMsg.sender_role === 'super_admin';

            const formattedMsg: ChatMessage = {
              id: newMsg.id,
              conversation_id: newMsg.conversation_id,
              body: newMsg.body,
              message_type: newMsg.message_type,
              created_at: newMsg.created_at,
              is_self: isSelf,
              sender_name: isSelf ? 'You' : isStaff ? 'Support Team' : (newMsg.sender_name || 'Customer'),
              sender_role: isSelf ? 'customer' : isStaff ? 'staff' : 'customer',
              status: 'sent',
            };

            const pendingIndex = prev.findIndex(
              (m) => m.status === 'pending' && m.body === newMsg.body && isSelf
            );
            if (pendingIndex !== -1) {
              const updated = [...prev];
              updated[pendingIndex] = formattedMsg;
              return updated;
            }

            return [...prev, formattedMsg];
          });
        }
      )
      .on('broadcast', { event: 'status_changed' }, (response: { payload: { status: ConversationStatus } }) => {
        if (response?.payload?.status) {
          setConversation((prev) => (prev ? { ...prev, status: response.payload.status } : null));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };`;

if (custOldRegex.test(custContent)) {
  custContent = custContent.replace(custOldRegex, custNewEffect);
  fs.writeFileSync(customerPath, custContent, 'utf8');
  console.log('CustomerChatClient.tsx updated successfully!');
} else {
  console.error('CustomerChatClient.tsx regex did not match.');
}

// 2. Update StaffChatClient.tsx
const staffPath = 'src/app/admin/conversations/[id]/StaffChatClient.tsx';
let staffContent = fs.readFileSync(staffPath, 'utf8');

const staffOldRegex = /\/\/ Connect to Supabase Realtime private channel for the conversation[\s\S]*?return \(\) => \{\s*supabase\.removeChannel\(channel\);\s*\};/m;

const staffNewEffect = `// Connect to Supabase Realtime via postgres_changes and broadcast for instant live delivery
  useEffect(() => {
    if (!conversationId || isAccessRevoked) return;

    const supabase = createClient();
    const topic = \`chat:\${conversationId}\`;

    const channel = supabase.channel(topic);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: \`conversation_id=eq.\${conversationId}\`,
        },
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            conversation_id: string;
            body: string;
            message_type: string;
            created_at: string;
            sender_id: string;
          };
          if (!newMsg || !newMsg.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            const isSelf = newMsg.sender_id === currentUser.id;
            const formattedMsg: StaffChatMessage = {
              id: newMsg.id,
              conversation_id: newMsg.conversation_id,
              sender_id: newMsg.sender_id,
              body: newMsg.body,
              message_type: newMsg.message_type,
              created_at: newMsg.created_at,
              is_self: isSelf,
              sender_name: isSelf ? 'You' : (conversation.customer?.display_name || 'Customer'),
              sender_role: isSelf ? currentUser.role : 'customer',
              status: 'sent',
            };

            const pendingIndex = prev.findIndex(
              (m) => m.status === 'pending' && m.body === newMsg.body && isSelf
            );
            if (pendingIndex !== -1) {
              const updated = [...prev];
              updated[pendingIndex] = formattedMsg;
              return updated;
            }

            return [...prev, formattedMsg];
          });
        }
      )
      .on(
        'broadcast',
        { event: 'new_message' },
        (response: {
          payload: {
            id: string;
            conversation_id: string;
            body: string;
            message_type: string;
            created_at: string;
            sender_id?: string;
            sender_role: string;
            sender_name?: string;
            true_sender_name?: string;
          };
        }) => {
          const newMsg = response.payload;
          if (!newMsg || !newMsg.id) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            const isSelf = newMsg.sender_id === currentUser.id;
            const staffSenderName = newMsg.true_sender_name || newMsg.sender_name || 'Staff Specialist';

            const formattedMsg: StaffChatMessage = {
              id: newMsg.id,
              conversation_id: newMsg.conversation_id,
              sender_id: newMsg.sender_id,
              body: newMsg.body,
              message_type: newMsg.message_type,
              created_at: newMsg.created_at,
              is_self: isSelf,
              sender_name: isSelf ? 'You' : newMsg.sender_role === 'customer' ? (newMsg.sender_name || 'Customer') : staffSenderName,
              sender_role: newMsg.sender_role,
              status: 'sent',
            };

            const pendingIndex = prev.findIndex(
              (m) => m.status === 'pending' && m.body === newMsg.body && isSelf
            );
            if (pendingIndex !== -1) {
              const updated = [...prev];
              updated[pendingIndex] = formattedMsg;
              return updated;
            }

            return [...prev, formattedMsg];
          });
        }
      )
      .on(
        'broadcast',
        { event: 'assignment_revoked' },
        (response: { payload: { conversation_id: string; admin_id: string; revoked_at: string } }) => {
          if (response?.payload?.admin_id === currentUser.id) {
            setIsAccessRevoked(true);
            setRevocationDetails('Your active assignment to this conversation was revoked by a Super Administrator.');
          }
        }
      )
      .on('broadcast', { event: 'assignment_added' }, () => {
        // Refresh conversation assignment list
      })
      .on('broadcast', { event: 'status_changed' }, (response: { payload: { status: ConversationStatus } }) => {
        if (response?.payload?.status) {
          setConversation((prev) => ({ ...prev, status: response.payload.status }));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };`;

if (staffOldRegex.test(staffContent)) {
  staffContent = staffContent.replace(staffOldRegex, staffNewEffect);
  fs.writeFileSync(staffPath, staffContent, 'utf8');
  console.log('StaffChatClient.tsx updated successfully!');
} else {
  console.error('StaffChatClient.tsx regex did not match.');
}
