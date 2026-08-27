import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { safeLocalStorage } from '../utils/storage';
import { EventDetails, Guest, TemplateSettings, UserAccount, CommitteeMember } from '../types';

interface EventCardContextProps {
  eventDetails: EventDetails | null;
  setEventDetails: React.Dispatch<React.SetStateAction<EventDetails | null>>;
  eventsList: EventDetails[];
  setEventsList: (newEvents: EventDetails[] | ((prev: EventDetails[]) => EventDetails[])) => void;
  guests: Guest[];
  setGuests: (newGuests: Guest[] | ((prev: Guest[]) => Guest[])) => void;
  templateSettings: TemplateSettings | null;
  setTemplateSettings: React.Dispatch<React.SetStateAction<TemplateSettings | null>>;
  userAccount: UserAccount | null;
  setUserAccount: React.Dispatch<React.SetStateAction<UserAccount | null>>;
  committeeMembers: CommitteeMember[];
  setCommitteeMembers: React.Dispatch<React.SetStateAction<CommitteeMember[]>>;
  isLoading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  saveState: (updates: any, actionDesc?: string, detailsDesc?: string) => Promise<void>;
  updateGuests: (updatedActiveGuests: Guest[], actionDesc?: string, skipServerSave?: boolean) => void;
  updateEventDetails: (details: EventDetails, oldId?: string) => void;
  refreshState: () => Promise<any>;
}

const EventCardContext = createContext<EventCardContextProps | undefined>(undefined);

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Inashindwa kuvuta taarifa za mfumo');
  return res.json();
});

export function EventCardProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  
  // Local reactive states matching App.tsx for backward-compatible rendering speed
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [eventsListState, setEventsListState] = useState<EventDetails[]>([]);
  const [guestsState, setGuestsState] = useState<Guest[]>([]);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  // Track deleted IDs so background polling doesn't resurrect them, while preserving unsaved local additions
  const deletedGuestIdsRef = useRef<Set<string>>(new Set());
  const deletedEventIdsRef = useRef<Set<string>>(new Set());

  const setEventsList = (newEvents: EventDetails[] | ((prev: EventDetails[]) => EventDetails[])) => {
    setEventsListState((prev) => {
      const resolved = typeof newEvents === 'function' ? newEvents(prev) : newEvents;
      const seen = new Set<string>();
      return resolved.filter((ev) => {
        if (!ev || !ev.id) return false;
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      });
    });
  };

  const setGuests = (newGuests: Guest[] | ((prev: Guest[]) => Guest[])) => {
    setGuestsState((prev) => {
      const resolved = typeof newGuests === 'function' ? newGuests(prev) : newGuests;
      const seen = new Set<string>();
      return resolved.filter((g) => {
        if (!g || !g.id) return false;
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
    });
  };

  // Central useSWR logic for background revalidation & smart caching
  const { data, error: swrError, isLoading: swrLoading, mutate: swrMutate } = useSWR('/api/state', fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 6000, // 6 seconds real-time background synchronization
    dedupingInterval: 2000,
    errorRetryCount: 3,
  });

  // Client Hydration / Synchronization when SWR cache changes
  useEffect(() => {
    if (data) {
      if (data.eventsList) {
        setEventsList((prevEvents) => {
          const incomingIds = new Set(data.eventsList.map((e: any) => e.id));
          const unsavedLocalEvents = prevEvents.filter(
            (localE) => !incomingIds.has(localE.id) && !deletedEventIdsRef.current.has(localE.id)
          );
          return [...data.eventsList, ...unsavedLocalEvents];
        });
      }
      if (data.guests) {
        setGuests((prevGuests) => {
          const incomingIds = new Set(data.guests.map((g: any) => g.id));
          
          // Filter out any guests from server that were deleted locally in this session
          const filteredIncomingDataGuests = data.guests.filter(
            (cg: any) => !deletedGuestIdsRef.current.has(cg.id)
          );

          // Preserve local guests that aren't in incoming server data yet (e.g. freshly created or during local save)
          // UNLESS they were explicitly deleted!
          const unsavedLocalGuests = prevGuests.filter(
            (localG) => !incomingIds.has(localG.id) && !deletedGuestIdsRef.current.has(localG.id)
          );

          const mergedFromData = filteredIncomingDataGuests.map((cg: any) => {
            const localG = prevGuests?.find((g) => g.id === cg.id);
            if (localG && localG.cardImageUrl) {
              return { ...cg, cardImageUrl: localG.cardImageUrl };
            }
            return cg;
          });

          return [...mergedFromData, ...unsavedLocalGuests];
        });
      }
      if (data.templateSettings) {
        setTemplateSettings(data.templateSettings);
      }
      if (data.userAccount) {
        setUserAccount(data.userAccount);
      }
      if (data.committee_members) {
        setCommitteeMembers(data.committee_members);
      }

      // Sync active eventDetails
      setEventDetails((prev) => {
        let targetEvent = data.eventDetails || null;
        if (prev) {
          const foundPrev = data.eventsList?.find((e: any) => e.id === prev.id);
          if (foundPrev) return foundPrev;
        }

        const localSavedId = safeLocalStorage.getItem('kadi_active_event_id');
        const dbSavedId = data.userAccount?.activeEventId;
        
        let found = data.eventsList?.find((e: any) => e.id === localSavedId);
        if (!found && dbSavedId) {
          found = data.eventsList?.find((e: any) => e.id === dbSavedId);
        }
        if (found) {
          targetEvent = found;
        }
        return targetEvent;
      });
    }
  }, [data]);

  useEffect(() => {
    if (swrError) {
      setError(swrError.message || 'Hitilafu imetokea wakati wa kupakia data.');
    }
  }, [swrError]);

  // Persist selected event fallback
  useEffect(() => {
    if (eventDetails && eventDetails.id) {
      safeLocalStorage.setItem('kadi_active_event_id', eventDetails.id);
    }
  }, [eventDetails]);

  // Handle saving state
  const saveState = async (updates: any, actionDesc?: string, detailsDesc?: string) => {
    try {
      setLocalLoading(true);
      let sanitizedUpdates = { ...updates };
      
      if (updates.eventDetails && updates.eventDetails.id) {
        safeLocalStorage.setItem('kadi_active_event_id', updates.eventDetails.id);
        
        const updatedAccount = userAccount ? {
          ...userAccount,
          activeEventId: updates.eventDetails.id
        } : {
          id: "account",
          username: 'Jimson',
          activeEventId: updates.eventDetails.id,
          walletBalance: 0,
          transactions: []
        };
        setUserAccount(updatedAccount as any);
        sanitizedUpdates.userAccount = updatedAccount;
      }
      
      if (actionDesc) {
        sanitizedUpdates.auditLog = {
          id: 'log-' + Date.now(),
          timestamp: new Date().toISOString(),
          user: 'Jimson',
          action: actionDesc,
          details: detailsDesc || 'Mabadiliko yamefanyika kwenye mfumo.'
        };
      }

      if (updates.eventsList && Array.isArray(updates.eventsList)) {
        const incomingEventIds = new Set(updates.eventsList.map((e: any) => e.id));
        const deletedEventIds = eventsListState.filter(e => !incomingEventIds.has(e.id)).map(e => e.id);
        if (deletedEventIds.length > 0) {
          sanitizedUpdates.deletedEventIds = deletedEventIds;
          deletedEventIds.forEach(id => deletedEventIdsRef.current.add(id));
        }
      }

      if (updates.guests && Array.isArray(updates.guests)) {
        const incomingIds = new Set(updates.guests.map((g: any) => g.id));
        const computedDeleted = guestsState.filter(g => !incomingIds.has(g.id)).map(g => g.id);
        const deletedGuestIds = updates.deletedGuestIds && updates.deletedGuestIds.length > 0
          ? Array.from(new Set([...updates.deletedGuestIds, ...computedDeleted]))
          : computedDeleted;

        if (deletedGuestIds.length > 0) {
          sanitizedUpdates.deletedGuestIds = deletedGuestIds;
          deletedGuestIds.forEach(id => deletedGuestIdsRef.current.add(id));
        }

        sanitizedUpdates.guests = updates.guests.map((g: any) => {
          const { cardImageUrl, ...rest } = g;
          return rest;
        });
      }

      // Optimistic mutate of SWR cache
      const optimisticData = {
        ...data,
        ...sanitizedUpdates,
        eventsList: updates.eventsList || eventsListState,
        guests: updates.guests ? updates.guests.map((g: any) => {
          const { cardImageUrl, ...rest } = g;
          return rest;
        }) : guestsState.map((g: any) => {
          const { cardImageUrl, ...rest } = g;
          return rest;
        }),
        templateSettings: updates.templateSettings || templateSettings,
        userAccount: sanitizedUpdates.userAccount || userAccount,
      };

      swrMutate(optimisticData, false);

      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedUpdates),
      });

      if (!response.ok) throw new Error('Inashindwa kuhifadhi taarifa kwenye server');
      
      const resJson = await response.json();
      if (resJson && resJson.state) {
        swrMutate(resJson.state, false);
      } else {
        swrMutate();
      }
    } catch (err: any) {
      console.error('Error in saveState hook:', err);
      setError(err.message || 'Mabadiliko hayakuweza kuhifadhiwa.');
    } finally {
      setLocalLoading(false);
    }
  };

  const updateGuests = (updatedActiveGuests: Guest[], actionDesc?: string, skipServerSave = false) => {
    if (!eventDetails) return;
    const activeOldGuests = guestsState.filter(g => g.eventId === eventDetails.id || (!g.eventId && eventDetails.id === 'event-starter'));
    const updatedActiveIds = new Set(updatedActiveGuests.map(g => g.id));
    const deletedActiveIds = activeOldGuests.filter(g => !updatedActiveIds.has(g.id)).map(g => g.id);

    deletedActiveIds.forEach(id => deletedGuestIdsRef.current.add(id));

    const otherGuests = guestsState.filter(g => g.eventId !== eventDetails.id && (g.eventId || eventDetails.id !== 'event-starter'));
    const merged = [...otherGuests, ...updatedActiveGuests];
    setGuests(merged);

    if (!skipServerSave) {
      saveState({ 
        guests: merged,
        deletedGuestIds: deletedActiveIds.length > 0 ? deletedActiveIds : undefined 
      }, actionDesc || 'Amesasisha orodha ya wageni (Guests Updated)', `Tukio: ${eventDetails.name}`);
    }
  };

  const updateEventDetails = (details: EventDetails, oldId?: string) => {
    const activeOldId = oldId || details.id;
    setEventDetails(details);
    
    let updatedList = eventsListState.map(ev => ev.id === activeOldId ? details : ev);
    if (!updatedList.some(ev => ev.id === details.id)) {
      updatedList.push(details);
    }
    setEventsList(updatedList);

    let updatedGuests = guestsState;
    if (activeOldId !== details.id) {
      updatedGuests = guestsState.map(g => g.eventId === activeOldId ? { ...g, eventId: details.id } : g);
      setGuests(updatedGuests);
    }

    saveState({ 
      eventDetails: details, 
      eventsList: updatedList,
      guests: updatedGuests
    }, 'Amesasisha mipangilio ya tukio (Event Settings Updated)', `Tukio: ${details.name}`);
  };

  const refreshState = async () => {
    return swrMutate();
  };

  const isLoading = swrLoading || localLoading;

  return (
    <EventCardContext.Provider value={{
      eventDetails,
      setEventDetails,
      eventsList: eventsListState,
      setEventsList,
      guests: guestsState,
      setGuests,
      templateSettings,
      setTemplateSettings,
      userAccount,
      setUserAccount,
      committeeMembers,
      setCommitteeMembers,
      isLoading,
      error,
      setError,
      saveState,
      updateGuests,
      updateEventDetails,
      refreshState
    }}>
      {children}
    </EventCardContext.Provider>
  );
}

// 1. Custom hook for Guest Management
export function useGuests() {
  const context = useContext(EventCardContext);
  if (!context) {
    throw new Error('useGuests lazima itumike ndani ya EventCardProvider');
  }
  return {
    guests: context.guests,
    setGuests: context.setGuests,
    updateGuests: context.updateGuests,
    isLoading: context.isLoading,
  };
}

// 2. Custom hook for Event Management
export function useEvent() {
  const context = useContext(EventCardContext);
  if (!context) {
    throw new Error('useEvent lazima itumike ndani ya EventCardProvider');
  }
  return {
    eventDetails: context.eventDetails,
    setEventDetails: context.setEventDetails,
    eventsList: context.eventsList,
    setEventsList: context.setEventsList,
    updateEventDetails: context.updateEventDetails,
    templateSettings: context.templateSettings,
    setTemplateSettings: context.setTemplateSettings,
    saveState: context.saveState,
    isLoading: context.isLoading,
  };
}

// 3. Custom hook for Wallet & Account
export function useWallet() {
  const context = useContext(EventCardContext);
  if (!context) {
    throw new Error('useWallet lazima itumike ndani ya EventCardProvider');
  }
  return {
    userAccount: context.userAccount,
    setUserAccount: context.setUserAccount,
    walletBalance: context.userAccount?.walletBalance || 0,
    transactions: context.userAccount?.transactions || [],
    isLoading: context.isLoading,
  };
}

// 4. Custom hook for Committee & Global Access
export function useEventCard() {
  const context = useContext(EventCardContext);
  if (!context) {
    throw new Error('useEventCard lazima itumike ndani ya EventCardProvider');
  }
  return context;
}
