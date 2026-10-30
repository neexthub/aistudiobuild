export const TOOL_SERVICES = [
  { id: 'explore', name: 'প্রজেক্ট অনুসন্ধান', status: 'local', detail: 'ফাইল এবং source অনুসন্ধান' },
  { id: 'providers', name: 'মাল্টি-প্রোভাইডার AI', status: 'local', detail: '১১টি ফ্রি প্রোভাইডার + Lovable AI; ⚙️ থেকে key যোগ করুন, অটো রোটেশন ও ফেইলওভার' },
  { id: 'agents', name: 'মাল্টি-এজেন্ট', status: 'local', detail: 'পরিকল্পনা → প্যারালাল সাব-এজেন্ট → মান যাচাই → টেস্ট → বিল্ড → পাবলিশ' },
  { id: 'image', name: 'ছবি তৈরি', status: 'local', detail: 'Pollinations (ফ্রি) — এজেন্টরা অ্যাপে ছবি বসায়' },
  { id: 'publish', name: 'পাবলিক প্রকাশ', status: 'local', detail: '/p/<নাম> লিংকে সবার জন্য প্রকাশ' },
  { id: 'url', name: 'URL পাঠক', status: 'blocked', detail: 'এখনো যুক্ত হয়নি' },
  { id: 'search', name: 'অনলাইন সার্চ', status: 'blocked', detail: 'এখনো যুক্ত হয়নি' },
  { id: 'video', name: 'ভিডিও তৈরি', status: 'blocked', detail: 'ফ্রি নির্ভরযোগ্য সার্ভিস নেই' },
  { id: 'runner', name: 'HTML বিল্ড', status: 'ready', detail: 'ব্রাউজারেই বহু-পাতার HTML/CSS/JS অ্যাপ বিল্ড ও প্রিভিউ হয়' },
] as const;
