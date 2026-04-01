import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="font-display text-8xl md:text-9xl font-bold text-gradient-animated mb-4">
          404
        </h1>
        <p className="font-display text-xl md:text-2xl text-foreground/70 mb-2">
          Page introuvable
        </p>
        <p className="font-body text-sm text-muted-foreground mb-10 max-w-sm mx-auto">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-display font-medium rounded-lg btn-primary-glow transition-all duration-300 hover:scale-105 text-sm"
        >
          <ArrowLeft size={16} />
          Retour à l'accueil
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
