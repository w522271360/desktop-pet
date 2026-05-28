function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTitle(title) {
  const normalized = String(title || '').trim().replace(/\s+/g, ' ');
  return normalized || '新对话';
}

function deriveConversationTitle(messages) {
  const firstQuestion = (messages || []).find(item => item?.question)?.question || '';
  const title = normalizeTitle(firstQuestion);
  return title.length > 28 ? `${title.slice(0, 28)}...` : title;
}

function normalizeConversation(conversation, existing = {}) {
  const timestamp = nowIso();
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return {
    id: conversation?.id || existing.id || generateId(),
    title: normalizeTitle(conversation?.title || existing.title || deriveConversationTitle(messages)),
    messages,
    apiMessages: Array.isArray(conversation?.apiMessages) ? conversation.apiMessages : [],
    createdAt: existing.createdAt || conversation?.createdAt || timestamp,
    updatedAt: conversation?.updatedAt || timestamp
  };
}

function sortConversations(conversations) {
  return conversations.slice().sort((a, b) => {
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });
}

function createConversationHistoryStore(store) {
  function getAll() {
    return sortConversations(store.get('conversationRecords', []));
  }

  function get(id) {
    return getAll().find(conversation => conversation.id === id) || null;
  }

  function upsert(conversation) {
    const conversations = store.get('conversationRecords', []);
    const index = conversations.findIndex(item => item.id === conversation.id);
    const existing = index >= 0 ? conversations[index] : {};
    const saved = normalizeConversation(conversation, existing);

    if (index >= 0) {
      conversations[index] = saved;
    } else {
      conversations.push(saved);
    }

    store.set('conversationRecords', sortConversations(conversations));
    return saved;
  }

  function rename(id, title) {
    const conversations = store.get('conversationRecords', []);
    const index = conversations.findIndex(item => item.id === id);
    if (index === -1) return null;

    conversations[index] = {
      ...conversations[index],
      title: normalizeTitle(title),
      updatedAt: nowIso()
    };
    store.set('conversationRecords', sortConversations(conversations));
    return conversations[index];
  }

  function remove(id) {
    const conversations = store.get('conversationRecords', []);
    const filtered = conversations.filter(item => item.id !== id);
    store.set('conversationRecords', filtered);
    return filtered.length !== conversations.length;
  }

  return {
    getAll,
    get,
    upsert,
    rename,
    delete: remove
  };
}

module.exports = {
  createConversationHistoryStore,
  deriveConversationTitle,
  normalizeConversation,
  normalizeTitle
};
