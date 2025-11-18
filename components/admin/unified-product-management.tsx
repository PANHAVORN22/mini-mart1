"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Edit,
  Trash2,
  Upload,
  Image as ImageIcon,
  Package,
  Milk,
  Zap,
  Calendar,
  Wine,
  PackagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import { Progress } from "@/components/ui/progress";
import type { PremiumEvent, PremiumRewardItem } from "@/lib/types";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  type: string;
  price: number;
  stock: number;
  description: string;
  image_url: string;
  is_premium: boolean;
  alcohol_content?: number;
  volume?: number;
  caffeine?: number;
  expiry_date?: string;
  barcode?: string;
  supplier?: string;
  cost_price?: number;
  created_at: string;
  updated_at: string;
}

interface NewProductForm {
  name: string;
  brand: string;
  category: string;
  type: string;
  price: string;
  stock: string;
  description: string;
  is_premium: boolean;
  alcohol_content: string;
  volume: string;
  caffeine: string;
  expiry_date: string;
  barcode: string;
  supplier: string;
  cost_price: string;
  image: File | null;
}

interface PremiumEventForm {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  banner_url: string;
  discount_percentage: string;
  featured_product_id: string;
  stock_limit: string;
}

interface RewardItemForm {
  name: string;
  description: string;
  points_cost: string;
  stock: string;
}

interface PremiumMemberRow {
  id: string;
  email: string;
  full_name: string | null;
  premium_points: number;
  is_premium: boolean | null;
  created_at: string;
}

type SupabaseListResponse<T> = {
  data: T[] | null;
  error: {
    message?: string;
    code?: string;
    [key: string]: unknown;
  } | null;
};

const SUPABASE_TIMEOUT_MS = 10000;

const toDateTimeLocal = (value: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const revokeObjectUrl = (url: string | null) => {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

interface UnifiedProductManagementProps {
  initialProducts?: Product[];
  initialLegacyMode?: boolean;
  initialError?: string;
  initialEvents?: PremiumEvent[];
  initialEventError?: string | null;
  initialEventTableMissing?: boolean;
  initialRewards?: PremiumRewardItem[];
  initialRewardError?: string | null;
}

const PRODUCT_CATEGORIES = [
  { value: "beer", label: "Beer", icon: Wine },
  { value: "milk", label: "Milk & Dairy", icon: Milk },
  { value: "energy-drink", label: "Energy Drinks", icon: Zap },
  { value: "daily-product", label: "Daily Products", icon: Calendar },
];

const PRODUCT_TYPES = {
  beer: [
    "ale",
    "ipa",
    "lager",
    "stout",
    "porter",
    "wheat",
    "pilsner",
    "belgian",
    "sour",
  ],
  milk: ["whole", "low-fat", "skim", "plant-based", "flavored", "organic"],
  "energy-drink": ["original", "sugar-free", "natural", "premium", "sports"],
  "daily-product": [
    "bakery",
    "fruit",
    "vegetable",
    "dairy",
    "pantry",
    "snacks",
    "frozen",
  ],
};

const initialFormState: NewProductForm = {
  name: "",
  brand: "",
  category: "",
  type: "",
  price: "",
  stock: "",
  description: "",
  is_premium: false,
  alcohol_content: "",
  volume: "",
  caffeine: "",
  expiry_date: "",
  barcode: "",
  supplier: "",
  cost_price: "",
  image: null,
};

const initialEventFormState: PremiumEventForm = {
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  banner_url: "",
  discount_percentage: "15",
  featured_product_id: "",
  stock_limit: "50",
};

const initialRewardFormState: RewardItemForm = {
  name: "",
  description: "",
  points_cost: "100",
  stock: "10",
};

export function UnifiedProductManagement({
  initialProducts = [],
  initialLegacyMode = false,
  initialError,
  initialEvents = [],
  initialEventError = null,
  initialEventTableMissing = false,
  initialRewards = [],
  initialRewardError = null,
}: UnifiedProductManagementProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] =
    useState<Product[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(initialProducts.length === 0);
  const [legacyMode, setLegacyMode] = useState(initialLegacyMode);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [newProduct, setNewProduct] =
    useState<NewProductForm>(initialFormState);
  const [premiumEvents, setPremiumEvents] =
    useState<PremiumEvent[]>(initialEvents);
  const [editingEvent, setEditingEvent] = useState<PremiumEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(
    initialEvents.length === 0 &&
      !initialEventError &&
      !initialEventTableMissing
  );
  const [eventTableMissing, setEventTableMissing] = useState(
    initialEventTableMissing
  );
  const [eventLoadError, setEventLoadError] = useState<string | null>(
    initialEventError
  );
  const [eventForm, setEventForm] = useState<PremiumEventForm>(
    initialEventFormState
  );
  const [eventBannerFile, setEventBannerFile] = useState<File | null>(null);
  const [eventBannerPreview, setEventBannerPreview] = useState<string | null>(
    null
  );
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadProgress, setBannerUploadProgress] = useState(0);
  const [eventStockUpdatingId, setEventStockUpdatingId] = useState<
    string | null
  >(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [rewardItems, setRewardItems] =
    useState<PremiumRewardItem[]>(initialRewards);
  const [isLoadingRewards, setIsLoadingRewards] = useState(
    initialRewards.length === 0 && !initialRewardError
  );
  const [rewardLoadError, setRewardLoadError] = useState<string | null>(
    initialRewardError
  );
  const [rewardForm, setRewardForm] = useState<RewardItemForm>(
    initialRewardFormState
  );
  const [editingReward, setEditingReward] = useState<PremiumRewardItem | null>(
    null
  );
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
  const [isSavingReward, setIsSavingReward] = useState(false);
  const [deletingRewardId, setDeletingRewardId] = useState<string | null>(null);
  const [rewardImageFile, setRewardImageFile] = useState<File | null>(null);
  const [rewardImagePreview, setRewardImagePreview] = useState<string | null>(
    null
  );
  const [premiumMembers, setPremiumMembers] = useState<PremiumMemberRow[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [editingMember, setEditingMember] = useState<PremiumMemberRow | null>(
    null
  );
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [pointLookupEmail, setPointLookupEmail] = useState("");
  const [pointLookupResult, setPointLookupResult] =
    useState<PremiumMemberRow | null>(null);
  const [isSearchingPointsUser, setIsSearchingPointsUser] = useState(false);
  const [pointDelta, setPointDelta] = useState("0");
  const [pointReason, setPointReason] = useState("");
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [memberPointInput, setMemberPointInput] = useState("0");
  const [isSavingMemberPoints, setIsSavingMemberPoints] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState<string | null>(null);
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) {
      return premiumMembers;
    }
    return premiumMembers.filter((member) => {
      const name = member.full_name?.toLowerCase() ?? "";
      const email = member.email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [memberSearch, premiumMembers]);

  const filterProducts = useCallback(() => {
    if (activeCategory === "all") {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(
        products.filter((p) => p.category === activeCategory)
      );
    }
  }, [activeCategory, products]);

  useEffect(() => {
    if (initialProducts.length === 0) {
      fetchProducts();
    } else {
      setIsLoading(false);
    }
    if (initialEventTableMissing) {
      setIsLoadingEvents(false);
    } else if (initialEvents.length === 0) {
      void fetchPremiumEvents();
    } else {
      void fetchPremiumEvents({ background: true });
    }

    if (initialRewards.length === 0) {
      void fetchRewardItems();
    } else {
      void fetchRewardItems({ background: true });
    }
    void fetchPremiumMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialError) {
      toast.error(initialError);
    }
  }, [initialError]);

  useEffect(() => {
    filterProducts();
  }, [filterProducts]);

  useEffect(() => {
    if (!isLoadingEvents) {
      return;
    }
    const timer = setTimeout(() => {
      setEventLoadError((prev) => prev || "Premium events request timed out");
      setIsLoadingEvents(false);
    }, SUPABASE_TIMEOUT_MS + 2000);
    return () => clearTimeout(timer);
  }, [isLoadingEvents]);

  useEffect(() => {
    if (!isLoadingRewards) {
      return;
    }
    const timer = setTimeout(() => {
      setRewardLoadError((prev) => prev || "Premium rewards request timed out");
      setIsLoadingRewards(false);
    }, SUPABASE_TIMEOUT_MS + 2000);
    return () => clearTimeout(timer);
  }, [isLoadingRewards]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setLegacyMode(false);

      const response = await fetch("/api/admin/products", {
        cache: "no-store",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to fetch products");
      }

      const payload = await response.json();
      setProducts(payload?.products || []);
      setLegacyMode(Boolean(payload?.legacyMode));
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch products"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPremiumMembers = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      try {
        if (!background) {
          setIsLoadingMembers(true);
          setMemberLoadError(null);
        }

        const response = await fetch("/api/admin/premium-members", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          next: { revalidate: 0 },
        });

        let payload: { members?: PremiumMemberRow[]; error?: string } | null =
          null;

        try {
          payload = await response.json();
        } catch (parseError) {
          console.warn(
            "Premium members API returned non-JSON payload",
            parseError
          );
        }

        if (!response.ok) {
          const message =
            payload?.error ||
            `Failed to load premium members (${response.status})`;
          throw new Error(message);
        }

        setPremiumMembers(payload?.members ?? []);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load premium members";
        console.error("Error fetching premium members:", error);
        if (!background) {
          setMemberLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!background) {
          setIsLoadingMembers(false);
        }
      }
    },
    []
  );

  const adjustPremiumPointsViaApi = useCallback(
    async ({
      userId,
      delta,
      reason,
    }: {
      userId: string;
      delta: number;
      reason: string;
    }) => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/admin/premium-members/adjust", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ userId, delta, reason }),
      });

      let payload: { newBalance?: number; error?: string } | null = null;
      try {
        payload = await response.json();
      } catch (parseError) {
        console.warn(
          "Adjust premium points API returned non-JSON payload",
          parseError
        );
      }

      if (!response.ok) {
        const message =
          payload?.error ||
          `Failed to adjust premium points (${response.status})`;
        throw new Error(message);
      }

      if (typeof payload?.newBalance !== "number") {
        throw new Error("Point adjustment succeeded but no balance returned");
      }

      return payload.newBalance;
    },
    []
  );

  const fetchPremiumEvents = useCallback(
    async (options?: { background?: boolean }) => {
      const isBackground = Boolean(options?.background);
      try {
        if (!isBackground) {
          setIsLoadingEvents(true);
          setEventLoadError(null);
        }

        const response = await fetch("/api/admin/premium-events", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          next: { revalidate: 0 },
        });

        let payload: { events?: PremiumEvent[]; error?: string } | null = null;

        try {
          payload = await response.json();
        } catch (parseError) {
          console.warn(
            "Premium events API returned non-JSON payload",
            parseError
          );
        }

        if (!response.ok) {
          const message =
            payload?.error ||
            `Failed to load premium events (${response.status})`;
          if (!isBackground) {
            setEventLoadError(message);
            toast.error(message);
          }
          return;
        }

        setPremiumEvents(payload?.events ?? []);
        if (!isBackground) {
          setEventLoadError(null);
        }
      } catch (error) {
        console.error("Unexpected error loading premium events:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unexpected error loading premium events";
        if (!isBackground) {
          setEventLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!isBackground) {
          setIsLoadingEvents(false);
        }
      }
    },
    []
  );

  const fetchRewardItems = useCallback(
    async (options?: { background?: boolean }) => {
      const isBackground = Boolean(options?.background);
      try {
        if (!isBackground) {
          setIsLoadingRewards(true);
          setRewardLoadError(null);
        }
        const response = await fetch("/api/admin/premium-rewards", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          next: { revalidate: 0 },
        });

        let payload: { rewards?: PremiumRewardItem[]; error?: string } | null =
          null;

        try {
          payload = await response.json();
        } catch (parseError) {
          console.warn(
            "Premium rewards API returned non-JSON payload",
            parseError
          );
        }

        if (!response.ok) {
          const message =
            payload?.error ||
            `Failed to load premium rewards (${response.status})`;
          if (!isBackground) {
            setRewardLoadError(message);
            toast.error(message);
          }
          return;
        }

        setRewardItems(payload?.rewards ?? []);
        if (!isBackground) {
          setRewardLoadError(null);
        }
      } catch (error) {
        console.error("Unexpected error loading premium rewards:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unexpected error loading premium rewards";
        if (!isBackground) {
          setRewardLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!isBackground) {
          setIsLoadingRewards(false);
        }
      }
    },
    []
  );

  const resetEventForm = () => {
    setEventForm(initialEventFormState);
    revokeObjectUrl(eventBannerPreview);
    setEventBannerFile(null);
    setEventBannerPreview(null);
    setBannerUploadProgress(0);
  };

  const resetRewardForm = () => {
    setRewardForm(initialRewardFormState);
    revokeObjectUrl(rewardImagePreview);
    setRewardImagePreview(null);
    setRewardImageFile(null);
  };

  const handleRewardDialogChange = (open: boolean) => {
    setIsRewardDialogOpen(open);
    if (!open) {
      setEditingReward(null);
      resetRewardForm();
    }
  };

  const getCategoryIcon = (category: string) => {
    const categoryInfo = PRODUCT_CATEGORIES.find((c) => c.value === category);
    return categoryInfo?.icon || Package;
  };

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.8,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error("Error compressing image:", error);
      return file;
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      setUploadProgress(20);

      const compressedFile = await compressImage(file);
      setUploadProgress(50);

      const supabase = getSupabaseBrowserClient();
      const extension = compressedFile.name.split(".").pop() || "jpg";
      const filePath = `premium-assets/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("beer-images")
        .upload(filePath, compressedFile, {
          cacheControl: "3600",
          contentType: compressedFile.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Upload failed");
      }

      setUploadProgress(90);

      const { data } = supabase.storage
        .from("beer-images")
        .getPublicUrl(filePath);
      setUploadProgress(100);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const uploadEventBanner = async (file: File): Promise<string | null> => {
    try {
      setIsUploadingBanner(true);
      setBannerUploadProgress(15);

      const compressedFile = await compressImage(file);
      setBannerUploadProgress(45);

      const supabase = getSupabaseBrowserClient();
      const extension = compressedFile.name.split(".").pop() || "jpg";
      const filePath = `event-banners/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("beer-images")
        .upload(filePath, compressedFile, {
          cacheControl: "3600",
          contentType: compressedFile.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Upload failed");
      }

      setBannerUploadProgress(90);

      const { data } = supabase.storage
        .from("beer-images")
        .getPublicUrl(filePath);
      setBannerUploadProgress(100);
      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading banner image:", error);
      toast.error("Failed to upload banner image");
      return null;
    } finally {
      setIsUploadingBanner(false);
      setTimeout(() => setBannerUploadProgress(0), 1000);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewProduct((prev) => ({ ...prev, image: file }));
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleEventBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setEventBannerFile(file);
    revokeObjectUrl(eventBannerPreview);
    setEventBannerPreview(URL.createObjectURL(file));
    // Reset manual URL field; it will be filled once upload succeeds.
    setEventForm((prev) => ({ ...prev, banner_url: "" }));
  };

  const clearEventBanner = () => {
    setEventBannerFile(null);
    revokeObjectUrl(eventBannerPreview);
    setEventBannerPreview(null);
    setEventForm((prev) => ({ ...prev, banner_url: "" }));
  };

  const handleRewardImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRewardImageFile(file);
    revokeObjectUrl(rewardImagePreview);
    setRewardImagePreview(URL.createObjectURL(file));
  };

  const clearRewardImage = () => {
    setRewardImageFile(null);
    revokeObjectUrl(rewardImagePreview);
    setRewardImagePreview(null);
  };

  const populateRewardForm = (reward: PremiumRewardItem) => {
    setRewardForm({
      name: reward.name ?? "",
      description: reward.description ?? "",
      points_cost: String(reward.points_cost ?? ""),
      stock: String(
        typeof reward.stock === "number"
          ? reward.stock
          : initialRewardFormState.stock
      ),
    });
    setRewardImageFile(null);
    revokeObjectUrl(rewardImagePreview);
    setRewardImagePreview(reward.image_url || null);
  };

  const startEditingReward = (reward: PremiumRewardItem) => {
    populateRewardForm(reward);
    setEditingReward(reward);
    setIsRewardDialogOpen(true);
  };

  const handleEventDialogChange = (open: boolean) => {
    setIsEventDialogOpen(open);
    if (!open) {
      setEditingEvent(null);
      resetEventForm();
    }
  };

  const populateEventForm = (event: PremiumEvent) => {
    setEventForm({
      title: event.title || "",
      description: event.description || "",
      starts_at: toDateTimeLocal(event.starts_at),
      ends_at: toDateTimeLocal(event.ends_at),
      banner_url: event.banner_url || "",
      discount_percentage:
        typeof event.discount_percentage === "number"
          ? String(event.discount_percentage)
          : "",
      featured_product_id: event.featured_product_id || "",
      stock_limit:
        typeof event.stock_limit === "number" ? String(event.stock_limit) : "",
    });
    setEventBannerFile(null);
    revokeObjectUrl(eventBannerPreview);
    setEventBannerPreview(event.banner_url || null);
  };

  const startEditingEvent = (event: PremiumEvent) => {
    setEditingEvent(event);
    populateEventForm(event);
    setIsEventDialogOpen(true);
  };

  const handleAddProduct = async () => {
    if (legacyMode) {
      toast.error("Create the products table before adding new items.");
      return;
    }

    if (
      !newProduct.name ||
      !newProduct.category ||
      !newProduct.price ||
      !newProduct.stock
    ) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSaving(true);

    try {
      let imageUrl = "";
      if (newProduct.image) {
        const uploadedUrl = await uploadImage(newProduct.image);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("products").insert({
        name: newProduct.name,
        brand: newProduct.brand || newProduct.name.split(" ")[0],
        category: newProduct.category,
        type: newProduct.type || "other",
        description: newProduct.description,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        image_url: imageUrl,
        is_premium: newProduct.is_premium,
        alcohol_content: newProduct.alcohol_content
          ? parseFloat(newProduct.alcohol_content)
          : null,
        volume: newProduct.volume ? parseInt(newProduct.volume) : null,
        caffeine: newProduct.caffeine ? parseInt(newProduct.caffeine) : null,
        expiry_date: newProduct.expiry_date || null,
        barcode: newProduct.barcode || null,
        supplier: newProduct.supplier || null,
        cost_price: newProduct.cost_price
          ? parseFloat(newProduct.cost_price)
          : null,
      });

      if (error) {
        console.error("Error adding product:", error);
        toast.error("Failed to add product");
        return;
      }

      toast.success("Product added successfully!");
      fetchProducts();
      setIsDialogOpen(false);
      setNewProduct(initialFormState);
      setImagePreview(null);
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Failed to add product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (
    productId: string,
    productName: string
  ) => {
    if (legacyMode) {
      toast.error(
        "Switch to the unified products table before deleting items."
      );
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete "${productName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) {
        console.error("Error deleting product:", error);
        toast.error("Failed to delete product");
        return;
      }

      toast.success("Product deleted successfully!");
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  const getEventStatus = (event: PremiumEvent) => {
    const now = new Date();
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);

    if (now < start) return "upcoming";
    if (now > end) return "ended";
    return "active";
  };

  const formatEventSchedule = (event: PremiumEvent) => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    return `${formatter.format(new Date(event.starts_at))} – ${formatter.format(
      new Date(event.ends_at)
    )}`;
  };

  const handleSaveEvent = async () => {
    if (eventTableMissing) {
      toast.error("Create the premium_events table before adding events");
      return;
    }

    if (!eventForm.title || !eventForm.starts_at || !eventForm.ends_at) {
      toast.error("Please fill in required fields for the event");
      return;
    }

    const startsAt = new Date(eventForm.starts_at);
    const endsAt = new Date(eventForm.ends_at);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      toast.error("Please provide valid dates");
      return;
    }

    if (endsAt <= startsAt) {
      toast.error("Event end time must be after the start time");
      return;
    }

    const parsedStockLimit = eventForm.stock_limit
      ? Math.max(0, Number.parseInt(eventForm.stock_limit, 10))
      : 0;

    if (Number.isNaN(parsedStockLimit)) {
      toast.error("Please enter a valid stock number for the event");
      return;
    }

    setIsSavingEvent(true);

    try {
      let bannerUrl = eventForm.banner_url.trim();

      if (eventBannerFile) {
        const uploadedBanner = await uploadEventBanner(eventBannerFile);
        if (!uploadedBanner) {
          return;
        }
        bannerUrl = uploadedBanner;
      }

      const supabase = getSupabaseBrowserClient();
      const payload = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        banner_url: bannerUrl || null,
        discount_percentage: eventForm.discount_percentage
          ? parseFloat(eventForm.discount_percentage)
          : null,
        featured_product_id: eventForm.featured_product_id || null,
        audience: "premium",
        stock_limit: parsedStockLimit,
      };

      let error;
      if (editingEvent) {
        ({ error } = await supabase
          .from("premium_events")
          .update(payload)
          .eq("id", editingEvent.id));
      } else {
        ({ error } = await supabase.from("premium_events").insert({
          ...payload,
          stock_remaining: parsedStockLimit,
        }));
      }

      if (error) {
        console.error("Error saving premium event:", error);
        toast.error("Failed to save premium event");
        return;
      }

      toast.success(
        editingEvent
          ? "Premium event updated successfully!"
          : "Premium event created successfully!"
      );
      await fetchPremiumEvents();
      handleEventDialogChange(false);
    } catch (error) {
      console.error("Error saving premium event:", error);
      toast.error("Failed to save premium event");
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleSaveReward = async () => {
    if (!rewardForm.name || !rewardForm.points_cost) {
      toast.error("Please provide a name and point cost for the reward");
      return;
    }

    const pointsCost = parseInt(rewardForm.points_cost, 10);
    const stockValue = rewardForm.stock ? parseInt(rewardForm.stock, 10) : 0;

    if (Number.isNaN(pointsCost) || pointsCost <= 0) {
      toast.error("Points cost must be a positive number");
      return;
    }

    if (Number.isNaN(stockValue) || stockValue < 0) {
      toast.error("Stock must be zero or higher");
      return;
    }

    setIsSavingReward(true);

    try {
      let imageUrl: string | null = editingReward?.image_url ?? null;
      if (rewardImageFile) {
        const uploadedImage = await uploadImage(rewardImageFile);
        if (!uploadedImage) {
          return;
        }
        imageUrl = uploadedImage;
      } else if (!rewardImagePreview) {
        imageUrl = null;
      }

      if (editingReward) {
        const response = await fetch(`/api/admin/rewards/${editingReward.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: rewardForm.name.trim(),
            description: rewardForm.description.trim() || null,
            pointsCost,
            stock: stockValue,
            imageUrl,
          }),
        });

        let payload: any = null;
        try {
          payload = await response.json();
        } catch (parseError) {
          if (response.ok) {
            console.warn(
              "Reward update API returned non-JSON payload",
              parseError
            );
          }
        }

        if (!response.ok) {
          const serverError =
            (payload && typeof payload.error === "string" && payload.error) ||
            `Failed to update reward (${response.status})`;
          toast.error(serverError);
          return;
        }

        toast.success("Reward updated successfully");
      } else {
        const response = await fetch("/api/admin/rewards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: rewardForm.name.trim(),
            description: rewardForm.description.trim() || null,
            pointsCost,
            stock: stockValue,
            imageUrl,
          }),
        });

        let payload: any = null;
        try {
          payload = await response.json();
        } catch (parseError) {
          if (response.ok) {
            console.warn("Reward API returned non-JSON payload", parseError);
          }
        }

        if (!response.ok) {
          const serverError =
            (payload && typeof payload.error === "string" && payload.error) ||
            `Failed to create reward (${response.status})`;
          console.error("Error creating premium reward:", payload);
          toast.error(serverError);
          return;
        }

        toast.success("Reward created successfully");
      }

      await fetchRewardItems();
      handleRewardDialogChange(false);
    } catch (error) {
      console.error(
        editingReward
          ? "Unexpected error updating reward:"
          : "Unexpected error creating reward:",
        error
      );
      toast.error(
        editingReward ? "Failed to update reward" : "Failed to create reward"
      );
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleAdjustEventStock = async (event: PremiumEvent) => {
    const stockLimitInput = prompt(
      `Set the total stock for "${event.title}"`,
      String(event.stock_limit ?? 0)
    );

    if (stockLimitInput === null) {
      return;
    }

    const parsedLimit = Math.max(0, Number.parseInt(stockLimitInput, 10));
    if (Number.isNaN(parsedLimit)) {
      toast.error("Please enter a valid number for total stock");
      return;
    }

    const remainingInput = prompt(
      "How many units are still available for members?",
      String(Math.min(event.stock_remaining ?? parsedLimit, parsedLimit))
    );

    if (remainingInput === null) {
      return;
    }

    const parsedRemaining = Math.max(
      0,
      Math.min(parsedLimit, Number.parseInt(remainingInput, 10))
    );

    if (Number.isNaN(parsedRemaining)) {
      toast.error("Please enter a valid number for remaining stock");
      return;
    }

    setEventStockUpdatingId(event.id);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("premium_events")
        .update({
          stock_limit: parsedLimit,
          stock_remaining: parsedRemaining,
        })
        .eq("id", event.id);

      if (error) {
        console.error("Error updating premium event stock:", error);
        toast.error("Failed to update stock");
        return;
      }

      toast.success("Premium event stock updated");
      await fetchPremiumEvents();
    } catch (error) {
      console.error("Error updating premium event stock:", error);
      toast.error("Failed to update stock");
    } finally {
      setEventStockUpdatingId(null);
    }
  };

  const handleDeleteEvent = async (
    eventId: string,
    eventTitle: string
  ): Promise<boolean> => {
    if (
      !confirm(
        `Are you sure you want to delete the "${eventTitle}" premium event?`
      )
    ) {
      return false;
    }

    setDeletingEventId(eventId);

    try {
      const response = await fetch(`/api/admin/premium-events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch (parseError) {
        if (!response.ok) {
          console.warn(
            "Premium event delete API returned non-JSON payload",
            parseError
          );
        }
      }

      if (!response.ok) {
        const serverError =
          (payload && typeof payload.error === "string" && payload.error) ||
          `Failed to delete premium event (${response.status})`;
        toast.error(serverError);
        return false;
      }

      toast.success("Premium event deleted");
      await fetchPremiumEvents();
      return true;
    } catch (error) {
      console.error("Error deleting premium event:", error);
      toast.error("Failed to delete premium event");
      return false;
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleToggleRewardActive = async (
    rewardId: string,
    nextState: boolean
  ) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("premium_reward_items")
        .update({ is_active: nextState })
        .eq("id", rewardId);

      if (error) {
        console.error("Error updating reward state:", error);
        toast.error("Failed to update reward");
        return;
      }

      await fetchRewardItems();
    } catch (error) {
      console.error("Unexpected error updating reward state:", error);
      toast.error("Failed to update reward");
    }
  };

  const handleRestockReward = async (reward: PremiumRewardItem) => {
    const input = window.prompt(
      `How many units do you want to add back to "${reward.name}"?`,
      "10"
    );

    if (!input) return;
    const amount = parseInt(input, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Please enter a positive number");
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("premium_reward_items")
        .update({ stock: reward.stock + amount })
        .eq("id", reward.id);

      if (error) {
        console.error("Error restocking reward:", error);
        toast.error("Failed to restock reward");
        return;
      }

      toast.success("Reward stock updated");
      await fetchRewardItems();
    } catch (error) {
      console.error("Unexpected error restocking reward:", error);
      toast.error("Failed to restock reward");
    }
  };

  const handleDeleteReward = async (
    reward: PremiumRewardItem
  ): Promise<boolean> => {
    if (
      !window.confirm(
        `Delete reward "${reward.name}"? This cannot be undone and members will no longer see it.`
      )
    ) {
      return false;
    }

    setDeletingRewardId(reward.id);

    try {
      const response = await fetch(`/api/admin/rewards/${reward.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch (parseError) {
        if (!response.ok) {
          console.warn(
            "Reward delete API returned non-JSON payload",
            parseError
          );
        }
      }

      if (!response.ok) {
        const serverError =
          (payload && typeof payload.error === "string" && payload.error) ||
          `Failed to delete reward (${response.status})`;
        toast.error(serverError);
        return false;
      }

      toast.success("Reward deleted");
      await fetchRewardItems();
      return true;
    } catch (error) {
      console.error("Unexpected error deleting reward:", error);
      toast.error("Failed to delete reward");
      return false;
    } finally {
      setDeletingRewardId(null);
    }
  };

  const startEditingMemberPoints = (member: PremiumMemberRow) => {
    setEditingMember(member);
    setMemberPointInput(String(member.premium_points ?? 0));
    setIsMemberDialogOpen(true);
  };

  const handleMemberDialogChange = (open: boolean) => {
    setIsMemberDialogOpen(open);
    if (!open) {
      setEditingMember(null);
      setMemberPointInput("0");
      setIsSavingMemberPoints(false);
    }
  };

  const handleSaveMemberPoints = async () => {
    if (!editingMember) {
      toast.error("Select a member first");
      return;
    }

    const nextBalance = parseInt(memberPointInput, 10);
    if (Number.isNaN(nextBalance) || nextBalance < 0) {
      toast.error("Point total must be zero or higher");
      return;
    }

    const currentBalance = editingMember.premium_points ?? 0;
    const delta = nextBalance - currentBalance;

    if (delta === 0) {
      toast.info("Member already has that many points");
      return;
    }

    setIsSavingMemberPoints(true);

    try {
      const newBalance = await adjustPremiumPointsViaApi({
        userId: editingMember.id,
        delta,
        reason: "Admin override via dashboard",
      });

      setPremiumMembers((prev) =>
        prev.map((member) =>
          member.id === editingMember.id
            ? {
                ...member,
                premium_points: newBalance,
              }
            : member
        )
      );

      setPointLookupResult((prev) =>
        prev && prev.id === editingMember.id
          ? {
              ...prev,
              premium_points: newBalance,
            }
          : prev
      );

      void fetchPremiumMembers({ background: true });

      toast.success("Member points updated");
      handleMemberDialogChange(false);
    } catch (error) {
      console.error("Error updating member points:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update points"
      );
    } finally {
      setIsSavingMemberPoints(false);
    }
  };

  const handleFindPointsUser = async () => {
    const query = pointLookupEmail.trim();
    if (!query) {
      toast.error("Enter an email to search");
      return;
    }

    setIsSearchingPointsUser(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, premium_points")
        .ilike("email", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error searching for user:", error);
        toast.error("Failed to find user");
        return;
      }

      if (!data) {
        toast.info("No user found with that email");
        setPointLookupResult(null);
        return;
      }

      setPointLookupResult(data);
      toast.success("User loaded");
    } catch (error) {
      console.error("Unexpected error searching for user:", error);
      toast.error("Failed to find user");
    } finally {
      setIsSearchingPointsUser(false);
    }
  };

  const handleAdjustPoints = async () => {
    if (!pointLookupResult) {
      toast.error("Load a user before adjusting points");
      return;
    }

    const delta = parseInt(pointDelta, 10);
    if (Number.isNaN(delta) || delta === 0) {
      toast.error("Point change must be a non-zero number");
      return;
    }

    setIsAdjustingPoints(true);

    try {
      const newBalance = await adjustPremiumPointsViaApi({
        userId: pointLookupResult.id,
        delta,
        reason: pointReason || "Manual adjustment",
      });

      setPointLookupResult((prev) =>
        prev ? { ...prev, premium_points: newBalance } : prev
      );

      void fetchPremiumMembers({ background: true });

      toast.success("Points updated");
    } catch (error) {
      console.error("Unexpected error adjusting points:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to adjust points"
      );
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      beer: "bg-amber-100 text-amber-800",
      milk: "bg-blue-100 text-blue-800",
      "energy-drink": "bg-red-100 text-red-800",
      "daily-product": "bg-green-100 text-green-800",
    };
    return (
      colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800"
    );
  };

  const getAvailableTypes = (category: string) => {
    return PRODUCT_TYPES[category as keyof typeof PRODUCT_TYPES] || [];
  };

  const renderCategorySpecificFields = () => {
    const { category } = newProduct;

    return (
      <div className="space-y-4">
        {category === "beer" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alcohol_content">Alcohol Content (%)</Label>
                <Input
                  id="alcohol_content"
                  type="number"
                  step="0.1"
                  value={newProduct.alcohol_content}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      alcohol_content: e.target.value,
                    }))
                  }
                  placeholder="e.g., 5.2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume">Volume (ml)</Label>
                <Input
                  id="volume"
                  type="number"
                  value={newProduct.volume}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      volume: e.target.value,
                    }))
                  }
                  placeholder="e.g., 355"
                />
              </div>
            </div>
          </>
        )}

        {category === "energy-drink" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="caffeine">Caffeine (mg)</Label>
                <Input
                  id="caffeine"
                  type="number"
                  value={newProduct.caffeine}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      caffeine: e.target.value,
                    }))
                  }
                  placeholder="e.g., 160"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume">Volume (ml)</Label>
                <Input
                  id="volume"
                  type="number"
                  value={newProduct.volume}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      volume: e.target.value,
                    }))
                  }
                  placeholder="e.g., 250"
                />
              </div>
            </div>
          </>
        )}

        {(category === "milk" || category === "daily-product") && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {category === "milk" && (
                <div className="space-y-2">
                  <Label htmlFor="volume">Volume (ml)</Label>
                  <Input
                    id="volume"
                    type="number"
                    value={newProduct.volume}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        volume: e.target.value,
                      }))
                    }
                    placeholder="e.g., 1000"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={newProduct.expiry_date}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      expiry_date: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p>Loading products...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {legacyMode && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Legacy mode (beers table)</p>
          <p>
            We detected that the unified <code>products</code> table is missing,
            so we are showing data from the old <code>beers</code> table. Create
            the new table using the provided SQL script to enable multi-category
            management.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage all your products across categories
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={legacyMode}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Create a new product in your inventory
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g., Craft IPA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={newProduct.brand}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        brand: e.target.value,
                      }))
                    }
                    placeholder="e.g., Local Brewery"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={newProduct.category || undefined}
                    onValueChange={(value) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        category: value,
                        type: "",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={newProduct.type || undefined}
                    onValueChange={(value) =>
                      setNewProduct((prev) => ({ ...prev, type: value }))
                    }
                    disabled={!newProduct.category}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTypes(newProduct.category).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                    placeholder="9.99"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock *</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        stock: e.target.value,
                      }))
                    }
                    placeholder="50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price ($)</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    value={newProduct.cost_price}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        cost_price: e.target.value,
                      }))
                    }
                    placeholder="5.00"
                  />
                </div>
              </div>

              {renderCategorySpecificFields()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={newProduct.barcode}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        barcode: e.target.value,
                      }))
                    }
                    placeholder="1234567890123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={newProduct.supplier}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        supplier: e.target.value,
                      }))
                    }
                    placeholder="Supplier name"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="premium"
                  checked={newProduct.is_premium}
                  onCheckedChange={(checked) =>
                    setNewProduct((prev) => ({ ...prev, is_premium: checked }))
                  }
                />
                <Label htmlFor="premium">Premium product</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Product Image</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="flex-1"
                  />
                  {imagePreview && (
                    // Preview uses a blob URL that Next/Image cannot optimize.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}
                </div>
                {isUploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-sm text-muted-foreground">
                      Uploading image... {uploadProgress}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setNewProduct(initialFormState);
                  setImagePreview(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddProduct} disabled={isSaving}>
                {isSaving ? "Adding..." : "Add Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Premium Member Events</CardTitle>
            <CardDescription>
              Create limited-time campaigns that appear on the premium page.
            </CardDescription>
          </div>
          <Dialog
            open={isEventDialogOpen}
            onOpenChange={handleEventDialogChange}
          >
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                className="gap-2"
                disabled={eventTableMissing}
                onClick={() => {
                  setEditingEvent(null);
                  resetEventForm();
                }}
              >
                <Zap className="h-4 w-4" />
                New Premium Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-white lg:max-w-2xl sm:px-6">
              <DialogHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ">
                  <div>
                    <DialogTitle>
                      {editingEvent
                        ? "Edit premium event"
                        : "Create premium-only event"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingEvent
                        ? "Update the details for this premium-only campaign."
                        : "Highlight exclusive deals that only premium members can see."}
                    </DialogDescription>
                  </div>
                  {editingEvent && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        const deleted = await handleDeleteEvent(
                          editingEvent.id,
                          editingEvent.title
                        );
                        if (deleted) {
                          handleEventDialogChange(false);
                        }
                      }}
                    >
                      <span className="flex items-center gap-2 bg-white-500 text-black px-2 py-1 rounded">
                        <Trash2 className="h-4 w-4 " />
                        Delete event
                      </span>
                    </Button>
                  )}
                </div>
              </DialogHeader>
              <div className="space-y-5 sm:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="event_title">Event title *</Label>
                  <Input
                    id="event_title"
                    value={eventForm.title}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Premium IPA Week"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event_description">Description *</Label>
                  <Textarea
                    id="event_description"
                    value={eventForm.description}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Share the event highlights..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="event_start">Starts *</Label>
                    <Input
                      id="event_start"
                      type="datetime-local"
                      value={eventForm.starts_at}
                      onChange={(e) =>
                        setEventForm((prev) => ({
                          ...prev,
                          starts_at: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event_end">Ends *</Label>
                    <Input
                      id="event_end"
                      type="datetime-local"
                      value={eventForm.ends_at}
                      onChange={(e) =>
                        setEventForm((prev) => ({
                          ...prev,
                          ends_at: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="event_discount">Discount %</Label>
                    <Input
                      id="event_discount"
                      type="number"
                      min="0"
                      max="100"
                      value={eventForm.discount_percentage}
                      onChange={(e) =>
                        setEventForm((prev) => ({
                          ...prev,
                          discount_percentage: e.target.value,
                        }))
                      }
                      placeholder="15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event_stock_limit">Event stock</Label>
                    <Input
                      id="event_stock_limit"
                      type="number"
                      min="0"
                      value={eventForm.stock_limit}
                      onChange={(e) =>
                        setEventForm((prev) => ({
                          ...prev,
                          stock_limit: e.target.value,
                        }))
                      }
                      placeholder="50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Set how many premium bundles or allocations are available
                      for this campaign.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event_banner">Banner image</Label>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <Input
                        id="event_banner"
                        type="file"
                        accept="image/*"
                        className="flex-1"
                        onChange={handleEventBannerChange}
                      />
                      {eventBannerPreview && (
                        <div className="relative h-16 w-28 overflow-hidden rounded-md border bg-muted">
                          {/* Banner preview relies on a blob URL */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={eventBannerPreview}
                            alt="Banner preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    {(eventBannerPreview || eventBannerFile) && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={clearEventBanner}
                          className="w-fit"
                        >
                          Remove banner
                        </Button>
                      </div>
                    )}
                    {isUploadingBanner && (
                      <div className="space-y-2">
                        <Progress value={bannerUploadProgress} />
                        <p className="text-sm text-muted-foreground">
                          Uploading banner... {bannerUploadProgress}%
                        </p>
                      </div>
                    )}
                    {!eventBannerPreview && (
                      <p className="text-xs text-muted-foreground">
                        Upload a landscape image (recommended 3:1 ratio) to show
                        on the premium page. Leave empty to skip the banner.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Featured product</Label>
                  <Select
                    value={eventForm.featured_product_id || "__none"}
                    onValueChange={(value) =>
                      setEventForm((prev) => ({
                        ...prev,
                        featured_product_id: value === "__none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Optional – choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">
                        No featured product
                      </SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editingEvent && (
                  <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
                    <p className="font-semibold text-destructive">
                      Delete this event
                    </p>
                    <p>
                      Removing the event hides it from members immediately. This
                      cannot be undone.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const deleted = await handleDeleteEvent(
                          editingEvent.id,
                          editingEvent.title
                        );
                        if (deleted) {
                          handleEventDialogChange(false);
                        }
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete event
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      handleEventDialogChange(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEvent} disabled={isSavingEvent}>
                    {isSavingEvent
                      ? "Saving..."
                      : editingEvent
                      ? "Save Changes"
                      : "Create Event"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {eventTableMissing && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">premium_events table missing</p>
              <p>
                Run <code>scripts/18-create-premium-events-table.sql</code> in
                Supabase to enable premium campaigns.
              </p>
            </div>
          )}

          {!eventTableMissing && (
            <div className="space-y-4">
              {isLoadingEvents && <p>Loading premium events...</p>}

              {!isLoadingEvents && eventLoadError && (
                <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  <div>
                    <p className="font-medium text-destructive">
                      Failed to load premium events
                    </p>
                    <p className="text-sm text-destructive/80">
                      {eventLoadError}
                    </p>
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchPremiumEvents()}
                      className="w-fit"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {!isLoadingEvents &&
                !eventLoadError &&
                premiumEvents.length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No premium events yet. Create one to spotlight exclusive
                    deals.
                  </div>
                )}

              {!isLoadingEvents &&
                !eventLoadError &&
                premiumEvents.length > 0 && (
                  <div className="space-y-3">
                    {premiumEvents.map((event) => {
                      const status = getEventStatus(event);
                      const featuredProduct = products.find(
                        (product) => product.id === event.featured_product_id
                      );

                      return (
                        <div
                          key={event.id}
                          className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">
                                {event.title}
                              </span>
                              <Badge
                                variant={
                                  status === "active"
                                    ? "default"
                                    : status === "upcoming"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {status === "active"
                                  ? "Live"
                                  : status === "upcoming"
                                  ? "Upcoming"
                                  : "Ended"}
                              </Badge>
                              {event.discount_percentage && (
                                <Badge variant="secondary">
                                  {event.discount_percentage}% off
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {event.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatEventSchedule(event)}
                            </p>
                            {typeof event.stock_limit === "number" &&
                              event.stock_limit > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {Math.max(0, event.stock_remaining ?? 0)} of{" "}
                                  {event.stock_limit} spots remaining
                                </p>
                              )}
                            {featuredProduct && (
                              <p className="text-xs text-muted-foreground">
                                Featuring: {featuredProduct.name}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditingEvent(event)}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAdjustEventStock(event)}
                              disabled={eventStockUpdatingId === event.id}
                            >
                              <PackagePlus className="mr-2 h-4 w-4" />
                              {eventStockUpdatingId === event.id
                                ? "Saving..."
                                : "Manage stock"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingEventId === event.id}
                              onClick={() =>
                                handleDeleteEvent(event.id, event.title)
                              }
                            >
                              {deletingEventId === event.id ? (
                                "Deleting..."
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Premium Rewards & Points</CardTitle>
            <CardDescription>
              Create catalog items for point redemptions and adjust member
              balances.
            </CardDescription>
          </div>
          <Dialog
            open={isRewardDialogOpen}
            onOpenChange={handleRewardDialogChange}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingReward(null);
                  resetRewardForm();
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add reward
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-white">
              <DialogHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <DialogTitle>
                      {editingReward
                        ? "Edit premium reward"
                        : "Create premium reward"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingReward
                        ? "Update the reward details members see on the premium page."
                        : "These items appear on the premium page for members to redeem with their points."}
                    </DialogDescription>
                  </div>
                  {editingReward && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deletingRewardId === editingReward.id}
                      onClick={async () => {
                        if (!editingReward) return;
                        const deleted = await handleDeleteReward(editingReward);
                        if (deleted) {
                          handleRewardDialogChange(false);
                        }
                      }}
                    >
                      {deletingRewardId === editingReward.id ? (
                        "Deleting..."
                      ) : (
                        <span className="flex items-center gap-2 bg-white-500 text-black px-2 py-1 rounded">
                          <Trash2 className="h-4 w-4 " />
                          Delete reward
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reward_name">Name *</Label>
                  <Input
                    id="reward_name"
                    value={rewardForm.name}
                    onChange={(e) =>
                      setRewardForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward_description">Description</Label>
                  <Textarea
                    id="reward_description"
                    value={rewardForm.description}
                    onChange={(e) =>
                      setRewardForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reward_points_cost">Points cost *</Label>
                    <Input
                      id="reward_points_cost"
                      type="number"
                      min="1"
                      value={rewardForm.points_cost}
                      onChange={(e) =>
                        setRewardForm((prev) => ({
                          ...prev,
                          points_cost: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reward_stock">
                      {editingReward ? "Stock on hand" : "Initial stock"}
                    </Label>
                    <Input
                      id="reward_stock"
                      type="number"
                      min="0"
                      value={rewardForm.stock}
                      onChange={(e) =>
                        setRewardForm((prev) => ({
                          ...prev,
                          stock: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward_image">Reward image</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="reward_image"
                      type="file"
                      accept="image/*"
                      onChange={handleRewardImageChange}
                    />
                    {rewardImagePreview && (
                      <div className="h-16 w-16 overflow-hidden rounded-md border bg-muted">
                        {/* Reward preview uses a blob URL */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={rewardImagePreview}
                          alt="Reward preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  {rewardImagePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-fit"
                      onClick={clearRewardImage}
                    >
                      Remove image
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRewardDialogChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveReward} disabled={isSavingReward}>
                    {isSavingReward
                      ? "Saving..."
                      : editingReward
                      ? "Save changes"
                      : "Create reward"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              {isLoadingRewards && <p>Loading rewards...</p>}
              {!isLoadingRewards && rewardLoadError && (
                <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  <div>
                    <p className="font-medium text-destructive">
                      Failed to load premium rewards
                    </p>
                    <p className="text-sm text-destructive/80">
                      {rewardLoadError}
                    </p>
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchRewardItems()}
                      className="w-fit"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
              {!isLoadingRewards &&
                !rewardLoadError &&
                rewardItems.length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No rewards yet. Create one to give members a way to redeem
                    points.
                  </div>
                )}
              {!isLoadingRewards &&
                !rewardLoadError &&
                rewardItems.length > 0 && (
                  <div className="space-y-3">
                    {rewardItems.map((reward) => (
                      <div
                        key={reward.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex flex-1 gap-4">
                          <div className="relative h-20 w-20 overflow-hidden rounded-md bg-muted">
                            <Image
                              src={reward.image_url || "/placeholder.svg"}
                              alt={reward.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="font-semibold">{reward.name}</p>
                            {reward.description && (
                              <p className="text-muted-foreground">
                                {reward.description}
                              </p>
                            )}
                            <p>
                              Cost:{" "}
                              <span className="font-medium">
                                {reward.points_cost} pts
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Stock: {reward.stock}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant={
                                  reward.is_active ? "default" : "outline"
                                }
                              >
                                {reward.is_active ? "Active" : "Hidden"}
                              </Badge>
                              {reward.stock === 0 && (
                                <Badge variant="destructive">
                                  Out of stock
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingReward(reward)}
                          >
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestockReward(reward)}
                          >
                            Restock
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleToggleRewardActive(
                                reward.id,
                                !reward.is_active
                              )
                            }
                          >
                            {reward.is_active ? "Hide" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteReward(reward)}
                            disabled={deletingRewardId === reward.id}
                          >
                            {deletingRewardId === reward.id ? (
                              "Deleting..."
                            ) : (
                              <>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="rounded-lg border p-4">
              <h3 className="mb-2 font-semibold">Adjust member points</h3>
              <p className="text-sm text-muted-foreground">
                Search for a customer, then apply a manual point change.
                Negative values deduct points.
              </p>
              <div className="mt-4 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="points_email">Member email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="points_email"
                      placeholder="customer@email.com"
                      value={pointLookupEmail}
                      onChange={(e) => setPointLookupEmail(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleFindPointsUser}
                      disabled={isSearchingPointsUser}
                    >
                      {isSearchingPointsUser ? "Searching..." : "Find"}
                    </Button>
                  </div>
                </div>

                {pointLookupResult && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">
                      {pointLookupResult.full_name || "Unnamed user"}
                    </p>
                    <p className="text-muted-foreground">
                      {pointLookupResult.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current balance: {pointLookupResult.premium_points} pts
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="points_delta">Point change</Label>
                    <Input
                      id="points_delta"
                      type="number"
                      value={pointDelta}
                      onChange={(e) => setPointDelta(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="points_reason">Reason</Label>
                    <Input
                      id="points_reason"
                      value={pointReason}
                      onChange={(e) => setPointReason(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleAdjustPoints}
                  disabled={isAdjustingPoints || !pointLookupResult}
                >
                  {isAdjustingPoints ? "Applying..." : "Apply point change"}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold">Premium members</h3>
                <p className="text-sm text-muted-foreground">
                  Review balances and override totals for premium customers.
                </p>
              </div>
              <div className="flex w-full gap-2 md:w-auto">
                <Input
                  placeholder="Search name or email"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void fetchPremiumMembers();
                  }}
                  disabled={isLoadingMembers}
                >
                  {isLoadingMembers ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {memberLoadError && !isLoadingMembers && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                <div className="flex flex-col gap-2">
                  <p className="font-medium">Failed to load premium members</p>
                  <p className="text-destructive/80">{memberLoadError}</p>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void fetchPremiumMembers();
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingMembers && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center">
                        Loading premium members...
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoadingMembers && filteredMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center">
                        No premium members found.
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoadingMembers &&
                    filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="font-medium">
                            {member.full_name || "Unnamed member"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">
                            {member.email}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {member.premium_points?.toLocaleString() ?? 0} pts
                          </span>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const created = new Date(member.created_at);
                            return Number.isNaN(created.getTime())
                              ? "—"
                              : created.toLocaleDateString();
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingMemberPoints(member)}
                          >
                            Edit points
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isMemberDialogOpen} onOpenChange={handleMemberDialogChange}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Update member points</DialogTitle>
            <DialogDescription>
              Set an exact balance for this premium member. Changes are logged
              to the point ledger.
            </DialogDescription>
          </DialogHeader>

          {editingMember && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {editingMember.full_name || "Unnamed member"}
                </p>
                <p className="text-muted-foreground">{editingMember.email}</p>
                <p className="text-xs text-muted-foreground">
                  Current balance: {editingMember.premium_points ?? 0} pts
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="member_points_target">New balance</Label>
                <Input
                  id="member_points_target"
                  type="number"
                  min="0"
                  value={memberPointInput}
                  onChange={(event) => setMemberPointInput(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the total number of points this member should have after
                  saving.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleMemberDialogChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMemberPoints}
              disabled={isSavingMemberPoints}
            >
              {isSavingMemberPoints ? "Saving..." : "Save balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">All Products</TabsTrigger>
          {PRODUCT_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const count = products.filter(
              (p) => p.category === category.value
            ).length;
            return (
              <TabsTrigger
                key={category.value}
                value={category.value}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {category.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {activeCategory !== "all" && (
                  <>
                    {(() => {
                      const Icon = getCategoryIcon(activeCategory);
                      return <Icon className="h-5 w-5" />;
                    })()}
                    {PRODUCT_CATEGORIES.find((c) => c.value === activeCategory)
                      ?.label || "All"}{" "}
                    Products
                  </>
                )}
                {activeCategory === "all" && (
                  <>
                    <Package className="h-5 w-5" />
                    All Products
                  </>
                )}
                <Badge variant="secondary">{filteredProducts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded">
                            <Image
                              src={product.image_url || "/placeholder.svg"}
                              alt={product.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {product.brand}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(product.category)}>
                          {
                            PRODUCT_CATEGORIES.find(
                              (c) => c.value === product.category
                            )?.label
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {product.type}
                      </TableCell>
                      <TableCell>${product.price.toFixed(2)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {product.stock === 0 ? (
                            <Badge variant="destructive">Out of Stock</Badge>
                          ) : product.stock < 10 ? (
                            <Badge variant="secondary">Low Stock</Badge>
                          ) : (
                            <Badge variant="default">In Stock</Badge>
                          )}
                          {product.is_premium && (
                            <Badge variant="outline">Premium</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleDeleteProduct(product.id, product.name)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredProducts.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No products found in this category.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
