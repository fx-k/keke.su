import React from 'react'
import config from 'config'
import Image from 'next/image'
import { GitHub, Telegram, Mail, RSS, Moments} from './icons'
import { Ma_Shan_Zheng } from 'next/font/google'
import { Typewriter } from 'nextjs-simple-typewriter'
import { shuffle } from 'lodash';

const ma_Shan_Zheng = Ma_Shan_Zheng({
  weight: '400',
  subsets: ['latin']
})

const links: { name: string; link: string }[] = config.links

// prettier-ignore
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  'GitHub': <GitHub className="text-xl" aria-hidden />,
  'Telegram': <Telegram className="text-xl" aria-hidden />,
  'Mail': <Mail className="text-xl" aria-hidden />,
  'RSS': <RSS className="text-xl" aria-hidden />,
  'Moments': <Moments className="text-xl" aria-hidden />,
}

const Profile = () => {
  return (
    <div className="relative my-12 sm:my-16">
      <div className="flex items-center">
        {config.avatar && (
          <div className="relative flex-shrink-0">
            <Image
              className="object-cover rounded-full p-1 bg-white dark:bg-zinc-900 ring-2 ring-zinc-400/20 shadow-lg dark:shadow-none shadow-zinc-600/10"
              src={config.avatar}
              alt="avatar"
              width={80}
              height={80}
              unoptimized
              priority
            />
          </div>
        )}
        <div className="ml-6">
          <h1 className={`${ma_Shan_Zheng.className} w-fit text-3xl font-medium text-primary bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent`}>
            {config.title}
          </h1>
          {/* <span className="inline-block mt-3 text-zinc-500">{config.description}</span> */}
          <span className="inline-block mt-3 text-zinc-500">
            <Typewriter
              words={shuffle(config.description_typing)}
              // loop={0}
              cursor
              cursorStyle='_'
              typeSpeed={170}
              deleteSpeed={50}
              delaySpeed={1000}
            /></span>
          <div className="flex items-center -mx-2 mt-1">
            {links.map(({ name, link }) => (
              <a
                key={link}
                className="inline p-2 rounded-full text-2xl transition-opacity opacity-50 hover:opacity-100"
                href={link}
                target="_blank"
                title={name}
                aria-label={name}
              >
                {SOCIAL_ICONS[name]}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
