
import React from 'react';
import { Twitter, Github, MapPin } from 'lucide-react';
import { Author } from '../types';

interface AuthorBioProps {
  author: Author;
}

export const AuthorBio: React.FC<AuthorBioProps> = ({ author }) => {
  return (
    <div className="bg-slate-50 rounded-[2.5rem] p-8 md:p-12 border border-slate-100 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 transition-all hover:shadow-lg hover:shadow-slate-100/50">
      <div className="relative group">
        <div className="absolute inset-0 bg-indigo-600 rounded-[2rem] rotate-6 scale-95 opacity-20 group-hover:rotate-12 transition-transform"></div>
        <img 
          src={author.avatar} 
          alt={author.name} 
          className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] object-cover relative z-10 border-4 border-white shadow-xl"
        />
      </div>
      
      <div className="flex-1 text-center md:text-left">
        <div className="mb-4">
          <span className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] mb-2 block">Written By</span>
          <h4 className="text-3xl font-bold text-slate-900 serif tracking-tight mb-1">{author.name}</h4>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{author.role}</p>
        </div>
        
        <p className="text-slate-600 leading-relaxed mb-8 text-lg font-light max-w-xl">
          {author.bio}
        </p>
        
        <div className="flex items-center justify-center md:justify-start gap-4">
          {author.socials?.twitter && (
            <a 
              href={author.socials.twitter} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-3 bg-white rounded-xl text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all border border-slate-100"
            >
              <Twitter className="w-5 h-5" />
            </a>
          )}
          {author.socials?.github && (
            <a 
              href={author.socials.github} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-3 bg-white rounded-xl text-slate-400 hover:text-slate-900 hover:shadow-md transition-all border border-slate-100"
            >
              <Github className="w-5 h-5" />
            </a>
          )}
          <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            <MapPin className="w-3 h-3" /> Digital Nomad
          </div>
        </div>
      </div>
    </div>
  );
};
