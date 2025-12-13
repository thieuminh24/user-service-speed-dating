// src/anonymous-chat/services/name-generator.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class NameGeneratorService {
  private readonly adjectives = [
    'Swift',
    'Brave',
    'Clever',
    'Gentle',
    'Wild',
    'Silent',
    'Bright',
    'Dark',
    'Golden',
    'Silver',
    'Mystic',
    'Noble',
    'Fierce',
    'Calm',
    'Bold',
    'Crimson',
    'Azure',
    'Emerald',
    'Ruby',
    'Jade',
    'Cosmic',
    'Stellar',
    'Lunar',
    'Solar',
    'Royal',
    'Shadow',
    'Thunder',
    'Crystal',
    'Velvet',
    'Scarlet',
    'Amber',
    'Violet',
    'Midnight',
    'Dawn',
    'Frost',
    'Storm',
    'Ocean',
    'Forest',
    'Desert',
    'Mountain',
    'Electric',
    'Magnetic',
    'Radiant',
    'Shining',
    'Glowing',
    'Ancient',
    'Eternal',
    'Infinite',
    'Celestial',
    'Divine',
  ];

  private readonly animals = [
    'Panda',
    'Fox',
    'Wolf',
    'Tiger',
    'Lion',
    'Eagle',
    'Hawk',
    'Owl',
    'Raven',
    'Phoenix',
    'Dragon',
    'Unicorn',
    'Dolphin',
    'Whale',
    'Shark',
    'Panther',
    'Jaguar',
    'Cheetah',
    'Leopard',
    'Lynx',
    'Bear',
    'Deer',
    'Elk',
    'Moose',
    'Bison',
    'Falcon',
    'Condor',
    'Sparrow',
    'Swan',
    'Crane',
    'Otter',
    'Seal',
    'Walrus',
    'Penguin',
    'Koala',
    'Cobra',
    'Python',
    'Viper',
    'Mantis',
    'Spider',
    'Butterfly',
    'Firefly',
    'Dragonfly',
    'Beetle',
    'Moth',
    'Rabbit',
    'Hare',
    'Squirrel',
    'Chipmunk',
    'Raccoon',
  ];

  /**
   * Generate a random anonymous name
   * Format: "{Adjective} {Animal}"
   * Example: "Swift Panda", "Crimson Fox"
   */
  generateAnonymousName(): string {
    const adjective =
      this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    const animal =
      this.animals[Math.floor(Math.random() * this.animals.length)];
    return `${adjective} ${animal}`;
  }

  /**
   * Generate a pair of unique anonymous names
   * Ensures both names are different
   */
  generateNamePair(): [string, string] {
    const name1 = this.generateAnonymousName();
    let name2 = this.generateAnonymousName();

    // Ensure uniqueness (unlikely collision, but safety check)
    let attempts = 0;
    while (name1 === name2 && attempts < 10) {
      name2 = this.generateAnonymousName();
      attempts++;
    }

    return [name1, name2];
  }
}
