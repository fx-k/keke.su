"use client";
import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import 'artalk/dist/Artalk.css';
import Artalk from 'artalk';
import { useTheme } from "next-themes";
import config from 'config'

const ArtalkComment = () => {
  const container = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const cleanPathname = pathname.endsWith('.html') ? pathname.slice(0, -5) : pathname;
  const artalk = useRef<Artalk>();
  const { resolvedTheme, forcedTheme } = useTheme()
  const isDarkMode = resolvedTheme === 'dark' || forcedTheme === 'dark'

  useEffect(() => {
    artalk.current = Artalk.init({
      el: container.current!,
      pageKey: cleanPathname,
      pageTitle: document.title,
      server: config.artalkServer,
      site: config.title,
      darkMode: isDarkMode,
      // ...
    });

    return () => {
      artalk.current?.destroy();
    };
  }, [cleanPathname]);

  useEffect(() => {
    if (artalk.current) {
      artalk.current.setDarkMode(isDarkMode);
    }
  }, [isDarkMode]);

  return <div ref={container}></div>;
};

export default ArtalkComment;
