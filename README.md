# Geometry Dash Genetic AI

Petit projet expérimental où une IA apprend à jouer à Geometry Dash grâce à un **algorithme génétique**.

L'objectif n'est pas de reproduire exactement le jeu original mais de créer un environnement simple permettant d'entraîner une IA à éviter les obstacles en apprenant par évolution.

Ce projet a été réalisé suite à une vidéo du YouTuber CODEBH qui présentait un concept similaire.

---

## Principe

L'IA ne possède aucune connaissance du niveau au départ.

On crée une population de **1000 joueurs virtuels** avec des génomes générés aléatoirement.

Chaque joueur possède des **capteurs (triggers)** positionnés autour du personnage.

Lorsque certaines conditions sont remplies (présence ou absence d'obstacles dans les capteurs), l'IA décide de **sauter**.

Après chaque génération :

1. Tous les joueurs sont simulés
2. Leur score correspond à la **distance parcourue**
3. Les **50 meilleurs** sont conservés (élites)
4. Chaque élite génère plusieurs **enfants mutants**

Ce processus se répète jusqu'à ce qu'un joueur réussisse à terminer le niveau.

---

## Structure du génome

Un génome est composé de :

```

Genome
├─ Network
│   ├─ Trigger
│   ├─ Trigger
│   └─ Trigger
└─ Network
    ├─ Trigger

```

- **Genome** : cerveau de l'IA (logique OR) 
- **Network** : ensemble de triggers (logique AND)  
- **Trigger** : capteur détectant un type d'objet

Un joueur saute si **au moins un réseau est actif**.

---

## Types de capteurs

Les triggers peuvent détecter :

- présence d'air
- présence d'un bloc
- présence d'un pic
- absence d'air
- absence d'un bloc
- absence d'un pic

---

## Algorithme génétique

Paramètres principaux :

- population : **1000**
- élites : **50**
- enfants par élite : **19**

Mutations possibles :

- 50% modifier un trigger
- 25% ajouter un trigger
- 25% supprimer un trigger

---

## Fonction de fitness

Le score d'un joueur correspond à :

```

la distance parcourue

```

Le joueur qui va le plus loin est considéré comme le meilleur de la génération.

---

## Objectifs du projet

Ce projet est surtout une **expérimentation autour des algorithmes génétiques** et de l'IA appliquée aux jeux.

Il permet notamment de visualiser :

- l'évolution des générations
- les plateaux d'apprentissage
- les solutions trouvées par l'algorithme

---

## Améliorations possibles

Quelques pistes pour améliorer le système :

- simplification des génomes
- ajout de speciation
- amélioration de la fonction de fitness
- nouveaux types de capteurs
- optimisation des mutations

---

## Article détaillé

Un article complet expliquant le projet est disponible ici :

https://alexisgrau.dev/blog/geometry-dash-avec-un-algorithme-genetique-en-java-script

---

## Licence

Projet open source à but expérimental.
