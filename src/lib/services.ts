export const TOOL_SERVICES = [
  { id: 'explore', name: 'প্রজেক্ট অনুসন্ধান', status: 'local', detail: 'ফাইল এবং source অনুসন্ধান' },
  { id: 'url', name: 'URL পাঠক', status: 'blocked', detail: 'নিরাপদ VPS URL gateway প্রয়োজন' },
  { id: 'search', name: 'অনলাইন সার্চ', status: 'blocked', detail: 'Search service সংযোগ প্রয়োজন' },
  { id: 'download', name: 'মিডিয়া ডাউনলোড', status: 'blocked', detail: 'Validated asset gateway প্রয়োজন' },
  { id: 'image', name: 'ছবি তৈরি', status: 'blocked', detail: 'Image generation service প্রয়োজন' },
  { id: 'video', name: 'ভিডিও তৈরি', status: 'blocked', detail: 'Video generation service প্রয়োজন' },
  { id: 'runner', name: 'Next.js build', status: 'blocked', detail: 'Isolated VPS runner প্রয়োজন' },
  { id: 'background', name: 'ব্যাকগ্রাউন্ড এজেন্ট', status: 'blocked', detail: 'Durable VPS worker প্রয়োজন; বর্তমান কাজ tab বন্ধ হলে চলবে না' },
  { id: 'publish', name: 'পাবলিক প্রকাশ', status: 'blocked', detail: 'Shared artifact host, DNS ও TLS প্রয়োজন' },
] as const;
