import { useEffect, useMemo, useState } from 'react';
import { useWorkflow } from '../context/WorkflowContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function Messages() {
  const { currentUser } = useWorkflow();
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [users, setUsers] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const filteredInbox = useMemo(
    () => {
      const participantQuery = participantSearch.trim().toLowerCase();
      return inbox
        .map((item) => ({
          ...item,
          _id: item.partnerId,
          partnerUsername: item.username || '',
          partnerEmail: item.email || '',
          partnerRole: item.role || '',
        }))
        .filter((item) =>
          participantQuery === '' ||
          item.partnerUsername.toLowerCase().includes(participantQuery) ||
          item.partnerEmail.toLowerCase().includes(participantQuery) ||
          item.partnerRole.toLowerCase().includes(participantQuery)
        );
    },
    [participantSearch, inbox]
  );

  const displayedItems = useMemo(
    () => {
      const participantQuery = participantSearch.trim().toLowerCase();
      const mappedInbox = inbox.map((item) => ({
        ...item,
        _id: item.partnerId,
        username: item.username || '',
        email: item.email || '',
        role: item.role || '',
      }));

      if (!participantQuery) {
        return mappedInbox;
      }

      const inboxMatches = mappedInbox.filter((item) =>
        item.username.toLowerCase().includes(participantQuery) ||
        item.email.toLowerCase().includes(participantQuery) ||
        item.role.toLowerCase().includes(participantQuery)
      );

      const userMatches = users
        .filter((user) =>
          (user.username || '').toLowerCase().includes(participantQuery) ||
          (user.email || '').toLowerCase().includes(participantQuery) ||
          (user.role || '').toLowerCase().includes(participantQuery)
        )
        .map((user) => {
          const inboxEntry = mappedInbox.find((item) => item._id === user._id);
          return {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            unreadCount: inboxEntry?.unreadCount || 0,
            latestText: inboxEntry?.latestText || '',
            latestAt: inboxEntry?.latestAt,
          };
        });

      const ids = new Set(inboxMatches.map((item) => item._id));
      const combined = [...inboxMatches, ...userMatches.filter((user) => !ids.has(user._id))];
      return combined;
    },
    [participantSearch, inbox, users]
  );

  const listTitle = participantSearch ? 'Search results' : 'Recent chats';

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/users/approvers`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Unable to load user accounts');
        }

        const data = await res.json();
        const accounts = data.filter((user) => user._id !== currentUser.id);
        setUsers(accounts);
      } catch (err) {
        setError(err?.message || 'Failed to load users');
      }
    };

    fetchUsers();
  }, [currentUser]);

  const loadInbox = async () => {
    if (!currentUser) return;

    setError(null);
    setLoadingInbox(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/messages/inbox`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Unable to load inbox');
      }

      const data = await res.json();
      setInbox(data.data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load inbox');
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (selectedUser || inbox.length === 0) return;

    const unread = inbox.find((item) => item.unreadCount > 0);
    if (!unread) return;

    setSelectedUser({
      _id: unread.partnerId,
      username: unread.username,
      email: unread.email,
      role: unread.role,
    });

    setInbox((prev) => prev.map((item) =>
      item.partnerId === unread.partnerId ? { ...item, unreadCount: 0 } : item
    ));
  }, [inbox, selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      setInbox((prev) => prev.map((item) =>
        item.partnerId === selectedUser._id ? { ...item, unreadCount: 0 } : item
      ));
    }

    setConversation([]);
    const fetchConversation = async () => {
      if (!selectedUser) {
        return;
      }
      setLoadingConversation(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/messages/${selectedUser._id}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Unable to load conversation');
        }
        const data = await res.json();
        setConversation(data.data || []);
        await loadInbox();
      } catch (err) {
        setError(err?.message || 'Failed to load conversation');
      } finally {
        setLoadingConversation(false);
      }
    };

    fetchConversation();
  }, [selectedUser]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setConversation([]);
    setInbox((prev) => prev.map((item) =>
      item.partnerId === user._id ? { ...item, unreadCount: 0 } : item
    ));
  };

  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientId: selectedUser._id, text: messageText.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }
      setConversation((prev) => [...prev, data.data]);
      setMessageText('');
    } catch (err) {
      setError(err?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-2/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
              <p className="text-sm text-gray-500">Chat with other accounts in the system.</p>
            </div>
          </div>

          <div className="mb-4">
            <input
              type="search"
              placeholder="Search names or roles..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">{listTitle}</div>
            {loadingInbox ? (
              <div className="p-4 text-sm text-gray-500">Loading chats...</div>
            ) : displayedItems.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                {participantSearch.trim() ? 'No matching accounts found.' : 'No chatted accounts yet.'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {displayedItems.map((user) => {
                  const isActive = selectedUser?._id === user._id;
                  const unreadCount = user.unreadCount || 0;
                  return (
                    <li key={user._id}>
                      <button
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <div>
                          <p className="text-sm font-medium">{user.username || user.email}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                              {unreadCount} new
                            </span>
                          )}
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">{user.role}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="w-full md:w-3/5">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">Conversation</p>
                  <p className="text-sm text-gray-500">
                    {selectedUser ? `Chatting with ${selectedUser.username || selectedUser.email}` : 'Select an account to view messages.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-[280px] px-4 py-5">
              {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              {selectedUser ? (
                loadingConversation ? (
                  <p className="text-sm text-gray-500">Loading conversation...</p>
                ) : conversation.length === 0 ? (
                  <p className="text-sm text-gray-500">No messages yet. Send the first one.</p>
                ) : (
                  <div className="space-y-3">
                    {conversation.map((message) => {
                      const isOwn = message.senderId === currentUser?.id;
                      return (
                        <div
                          key={message._id}
                          className={`rounded-2xl p-3 ${isOwn ? 'ml-auto bg-blue-600 text-white' : 'bg-yellow-100 text-gray-900'} max-w-[85%]`}
                        >
                          <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                          <p className={`mt-2 text-[11px] ${isOwn ? 'text-gray-200' : 'text-black'} opacity-80`}>{new Date(message.createdAt).toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-500">Choose an account from the list to start a chat.</p>
              )}
            </div>

            <div className="border-t border-gray-100 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={!selectedUser}
                  placeholder={selectedUser ? 'Type a message...' : 'Select an account to chat.'}
                  className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:bg-blue-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!selectedUser || !messageText.trim() || sending}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
