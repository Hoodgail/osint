export interface Profile {

     username: string;

     social: "github" | "unknown";

     bio: string;

     followers: number;

     following: number;

     /**
      * Custom name, display name, or first & last name.
      */
     name: string;

     location: string;

     /**
      * Urls of other socials linked to this profile, or other links.
      */
     links?: string[]
}