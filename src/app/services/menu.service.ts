import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MenuItem } from '../models/menu-item.model';
import { environment } from '../../environments/environment';
import { catchError, map, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  // Signals for application state
  private readonly menuItemsSignal = signal<MenuItem[]>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly usingMockDataSignal = signal<boolean>(false);

  // Public read-only signals
  public readonly menuItems = computed(() => this.menuItemsSignal());
  public readonly loading = computed(() => this.loadingSignal());
  public readonly error = computed(() => this.errorSignal());
  public readonly usingMockData = computed(() => this.usingMockDataSignal());

  // Extracted unique categories signal
  public readonly categories = computed(() => {
    const items = this.menuItemsSignal();
    const unique = new Set(items.map(item => item.Category));
    return Array.from(unique);
  });

  // Grouped menu items signal: { [category: string]: MenuItem[] }
  public readonly groupedMenu = computed(() => {
    const items = this.menuItemsSignal();
    return items.reduce((acc, item) => {
      if (!acc[item.Category]) {
        acc[item.Category] = [];
      }
      acc[item.Category].push(item);
      return acc;
    }, {} as { [key: string]: MenuItem[] });
  });

  constructor(private http: HttpClient) {
    this.loadMenu();
  }

  /**
   * Fetches menu items from Google Sheets CSV, falls back to local mock data on failure.
   */
  public loadMenu(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.usingMockDataSignal.set(false);

    const csvUrl = environment.menuCsvUrl;

    if (!csvUrl) {
      console.warn('Google Sheets CSV URL not configured. Loading local fallback menu data.');
      this.loadMockData();
      return;
    }

    this.http.get(csvUrl, { responseType: 'text' }).pipe(
      map(data => {
        const parsed = this.parseCSV(data);
        if (parsed.length === 0) {
          throw new Error('No valid rows parsed from Google Sheet.');
        }
        return parsed;
      }),
      catchError(err => {
        console.error('Failed to load menu from Google Sheets CSV:', err);
        this.errorSignal.set('Could not fetch live menu from spreadsheet. Displaying offline demo menu.');
        this.usingMockDataSignal.set(true);
        return of(this.parseCSV(this.getMockCSVData()));
      })
    ).subscribe({
      next: (items) => {
        this.menuItemsSignal.set(items);
        this.loadingSignal.set(false);
      },
      error: (err) => {
        console.error('Subscription error in MenuService:', err);
        this.loadingSignal.set(false);
      }
    });
  }

  /**
   * Directly load the local mock data for testing.
   */
  private loadMockData(): void {
    this.usingMockDataSignal.set(true);
    const mockItems = this.parseCSV(this.getMockCSVData());
    this.menuItemsSignal.set(mockItems);
    this.loadingSignal.set(false);
  }

  /**
   * Parses CSV string into MenuItem array, safely handling quoted fields and whitespace.
   */
  public parseCSV(csvText: string): MenuItem[] {
    const lines = csvText.split(/\r?\n/);
    const items: MenuItem[] = [];

    if (lines.length <= 1) return [];

    // Find columns mapping from the header row
    const headers = this.parseCSVLine(lines[0]);
    const colMap = {
      category: headers.findIndex(h => h.toLowerCase() === 'category'),
      itemName: headers.findIndex(h => h.toLowerCase() === 'itemname'),
      description: headers.findIndex(h => h.toLowerCase() === 'description'),
      price: headers.findIndex(h => h.toLowerCase() === 'price'),
      isVegetarian: headers.findIndex(h => h.toLowerCase() === 'isvegetarian'),
      isGlutenFree: headers.findIndex(h => h.toLowerCase() === 'isglutenfree')
    };

    // If headers don't match, fall back to index-based mapping (A, B, C, D, E, F)
    const getColIndex = (index: number, mapVal: number) => mapVal !== -1 ? mapVal : index;
    const catIdx = getColIndex(0, colMap.category);
    const nameIdx = getColIndex(1, colMap.itemName);
    const descIdx = getColIndex(2, colMap.description);
    const priceIdx = getColIndex(3, colMap.price);
    const vegIdx = getColIndex(4, colMap.isVegetarian);
    const gfIdx = getColIndex(5, colMap.isGlutenFree);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = this.parseCSVLine(line);
      if (columns.length <= Math.max(catIdx, nameIdx)) continue;

      const category = columns[catIdx]?.trim() || 'General';
      const itemName = columns[nameIdx]?.trim() || 'Unnamed Item';
      const description = columns[descIdx]?.trim() || '';
      
      const priceRaw = columns[priceIdx]?.trim().replace(/[^0-9.]/g, '') || '0';
      const price = parseFloat(priceRaw) || 0;

      const isVegetarian = columns[vegIdx] ? columns[vegIdx].trim().toUpperCase() === 'TRUE' : false;
      const isGlutenFree = columns[gfIdx] ? columns[gfIdx].trim().toUpperCase() === 'TRUE' : false;

      // Filter out header line duplicates if they show up in data rows
      if (category.toLowerCase() === 'category' && itemName.toLowerCase() === 'itemname') {
        continue;
      }

      items.push({
        Category: category,
        ItemName: itemName,
        Description: description,
        Price: price,
        isVegetarian,
        isGlutenFree
      });
    }

    return items;
  }

  /**
   * Splits a single CSV line into columns, respecting double-quoted values.
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Escaped quote: double double-quotes inside quotes
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Generates a large CSV string with over 100+ menu items across various categories.
   */
  private getMockCSVData(): string {
    const header = 'Category,ItemName,Description,Price,isVegetarian,isGlutenFree\n';
    const rows: string[] = [];

    // All Day Breakfast (15 items)
    const breakfast = [
      ['All Day Breakfast', 'The Espresso Big Breakfast', 'Two free-range eggs cooked your way, artisanal sourdough toast, crispy maple-cured bacon, grilled Spanish chorizo, hash browns, roasted field mushrooms, and vine-ripened tomatoes.', '24.50', 'FALSE', 'FALSE'],
      ['All Day Breakfast', 'Avocado & Heirloom Toast', 'Smashed Hass avocado on toasted seed sourdough, topped with baby heirloom tomatoes, Danish feta, micro-herbs, house dukkah, and a drizzle of cold-pressed olive oil.', '18.90', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'Truffle Scramble', 'Three fluffy free-range eggs scrambled with black truffle paste, chives, shaved parmesan, served on toasted brioche.', '21.00', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'Chili Scrambled Eggs', 'Spicy folded eggs with fresh red chilies, spring onion, fresh coriander, and feta cheese on grilled sourdough.', '19.50', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'Eggs Benedict', 'Two poached free-range eggs on toasted English muffins, thick-cut Canadian bacon, and house-made warm hollandaise sauce.', '19.00', 'FALSE', 'FALSE'],
      ['All Day Breakfast', 'Florentine Eggs', 'Two poached free-range eggs on toasted sourdough, wilted baby spinach, and house-made warm hollandaise sauce.', '18.50', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'Smoked Salmon Royale', 'Two poached eggs, premium Tasmanian smoked salmon, sauteed baby spinach, dill hollandaise, served on toasted dark rye bread.', '22.50', 'FALSE', 'FALSE'],
      ['All Day Breakfast', 'Acai Berry Energy Bowl', 'Organic blended acai berries, coconut water, topped with gluten-free almond granola, fresh strawberries, blueberries, banana, chia seeds, and organic honey.', '16.50', 'TRUE', 'TRUE'],
      ['All Day Breakfast', 'Wild Mushroom Ragu', 'Assorted forest mushrooms sauteed in garlic herb butter, white wine, served on sourdough toast with a soft poached egg and goat cheese.', '20.50', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'Baked Shakshuka Eggs', 'Two eggs slow-cooked in a rich spiced tomato and red pepper sauce, topped with crumbled feta, fresh parsley, served with toasted flatbread.', '19.90', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'Gluten-Free Buttermilk Pancakes', 'Three golden fluffy gluten-free pancakes served with warm maple syrup, seasonal wild berry compote, and fresh double cream.', '18.00', 'TRUE', 'TRUE'],
      ['All Day Breakfast', 'Granola Parfait', 'Layers of Greek yogurt, toasted oats, pumpkin seeds, walnuts, dried cranberries, topped with fresh raspberries and passionfruit pulp.', '14.00', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'French Toast Brioche', 'Thick slice of brioche dipped in cinnamon custard, grilled, topped with caramelized banana, maple bacon, and vanilla bean mascarpone.', '19.90', 'FALSE', 'FALSE'],
      ['All Day Breakfast', 'Smashed Pumpkin Sourdough', 'Roasted butternut pumpkin mash, toasted pine nuts, goat cheese, baby rocket, and a poached egg on artisanal sourdough.', '17.90', 'TRUE', 'FALSE'],
      ['All Day Breakfast', 'Breakfast Burrito Wrap', 'Scrambled eggs, black beans, tomato salsa, jalapenos, cheese, avocado, wrapped in a spinach tortilla.', '16.90', 'TRUE', 'FALSE']
    ];

    // Gourmet Paninis (15 items)
    const paninis = [
      ['Gourmet Paninis', 'Chicken Pesto & Mozzarella', 'Grilled chicken breast, nut-free basil pesto, melted fresh mozzarella, baby spinach, and sliced roma tomatoes on pressed sourdough.', '16.90', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Prosciutto & Fig', 'Premium Italian prosciutto, sweet fig jam, gorgonzola cheese, fresh baby rocket, pressed on rustic ciabatta bread.', '17.90', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'The Vegetarian Harvest', 'Grilled zucchini, eggplant, roasted red peppers, spinach, artichoke hearts, and vegan basil aioli on pressed multi-grain panini.', '15.90', 'TRUE', 'FALSE'],
      ['Gourmet Paninis', 'Tuscan Salami', 'Mild genoa salami, provolone cheese, olive tapenade, fresh basil, and extra virgin olive oil pressed on herb focaccia.', '16.50', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Roast Beef & Horseradish', 'Slow-cooked roast beef, melted Swiss cheese, caramelized onions, rocket, and creamy horseradish dressing pressed on sourdough.', '17.50', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Three Cheese Melt', 'A rich blend of cheddar, Swiss, and fontina cheeses with a hint of garlic butter, pressed on sourdough.', '12.90', 'TRUE', 'FALSE'],
      ['Gourmet Paninis', 'Turkey Cranberry & Brie', 'Sliced smoked turkey breast, double cream brie cheese, wild cranberry sauce, and baby spinach pressed on rustic panini.', '16.90', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Tuna Salad Melt', 'Line-caught tuna salad, capers, red onion, celery, melted cheddar cheese, and sliced tomato on toasted whole wheat.', '15.50', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Spicy Meatball Marinara', 'Beef meatballs, rich house marinara sauce, melted mozzarella, fresh basil, pressed on a soft baguette.', '16.90', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Mushroom & Truffle Panini', 'Sauteed Swiss brown mushrooms, white truffle oil, melted fontina cheese, and baby spinach pressed on ciabatta.', '17.00', 'TRUE', 'FALSE'],
      ['Gourmet Paninis', 'BBQ Pulled Pork', 'Slow-cooked pulled pork shoulder, tangy barbecue sauce, homemade coleslaw, and pickles pressed on soft brioche panini.', '17.90', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Caprese Panini', 'Vine-ripened tomatoes, fresh buffalo mozzarella, fresh basil leaves, balsamic glaze reduction, and olive oil on pressed ciabatta.', '14.90', 'TRUE', 'FALSE'],
      ['Gourmet Paninis', 'Ham & Gruyere Classic', 'Shaved off-the-bone leg ham, gruyere cheese, dijon mustard, and cornichons pressed on rustic sourdough.', '15.90', 'FALSE', 'FALSE'],
      ['Gourmet Paninis', 'Eggplant Parmigiana Panini', 'Crispy herb-crumbed eggplant, marinara sauce, parmesan, melted mozzarella, and fresh basil pressed on ciabatta.', '16.00', 'TRUE', 'FALSE'],
      ['Gourmet Paninis', 'Vegan Chipotle Jackfruit', 'Smoked pulled jackfruit, chipotle vegan mayo, avocado, and shredded cabbage slaw pressed on gluten-free panini.', '17.50', 'TRUE', 'TRUE']
    ];

    // Healthy Wraps (15 items)
    const wraps = [
      ['Healthy Wraps', 'Classic Chicken Caesar Wrap', 'Grilled chicken, crisp baby cos lettuce, shaved parmesan, crispy bacon bits, Caesar dressing, wrapped in a garlic herb tortilla.', '15.90', 'FALSE', 'FALSE'],
      ['Healthy Wraps', 'Falafel & Hummus Wrap', 'House-made spiced herb falafels, creamy hummus, cucumber, tomato, red onion, pickled turnip, and tahini dressing wrapped in Lebanese flatbread.', '14.90', 'TRUE', 'FALSE'],
      ['Healthy Wraps', 'Smoked Salmon & Cream Cheese', 'Cold-smoked Tasmanian salmon, whipped herb cream cheese, cucumber ribbons, red onion, capers, and baby spinach in a spinach wrap.', '17.90', 'FALSE', 'FALSE'],
      ['Healthy Wraps', 'Tandoori Chicken Wrap', 'Tandoori-spiced chicken breast, mint yogurt raita, baby spinach, cucumber, tomato, and red onion wrapped in a warm flatbread.', '16.00', 'FALSE', 'FALSE'],
      ['Healthy Wraps', 'Greek Salad & Grilled Haloumi', 'Warm grilled haloumi, kalamata olives, cucumber, tomatoes, red onion, butter lettuce, and dried oregano dressing in a soft wrap.', '15.90', 'TRUE', 'FALSE'],
      ['Healthy Wraps', 'Mexican Beef & Bean Wrap', 'Spiced ground beef, black beans, brown rice, sweet corn, tomato salsa, cheddar, and sour cream wrapped in a flour tortilla.', '16.50', 'FALSE', 'FALSE'],
      ['Healthy Wraps', 'Vegan Avocado Crunch', 'Smashed avocado, shredded carrot, purple cabbage, cucumber, alfalfa sprouts, spinach, and sunflower seeds with lemon tahini in a spinach wrap.', '14.50', 'TRUE', 'TRUE'],
      ['Healthy Wraps', 'Sweet Potato & Black Bean', 'Roasted sweet potato cubes, spiced black beans, quinoa, sweet corn, coriander, and vegan lime crema in a spinach wrap.', '15.00', 'TRUE', 'TRUE'],
      ['Healthy Wraps', 'Teriyaki Tofu Wrap', 'Crispy organic tofu cubes, sweet teriyaki glaze, shredded carrot, cucumber, spring onions, sesame seeds, and brown rice in a flatbread wrap.', '14.90', 'TRUE', 'FALSE'],
      ['Healthy Wraps', 'Buffalo Chicken Wrap', 'Crispy chicken tenders tossed in spicy buffalo sauce, blue cheese dressing, celery, and shredded lettuce in a flour wrap.', '16.00', 'FALSE', 'FALSE'],
      ['Healthy Wraps', 'Thai Sweet Chili Wrap', 'Grilled chicken strips, sweet chili sauce, shredded lettuce, carrot, coriander, roasted peanuts, and crispy fried shallots.', '15.90', 'FALSE', 'FALSE'],
      ['Healthy Wraps', 'Middle Eastern Lamb Kofta', 'Spiced minced lamb skewers, garlic toum sauce, tomato, cucumber, parsley, and pickled turnip wrapped in warm flatbread.', '17.50', 'FALSE', 'FALSE'],
      ['Healthy Wraps', 'Mediterranean Veggie Wrap', 'Roasted zucchini, capsicum, olives, artichokes, feta cheese, rocket, and olive tapenade in a sundried tomato wrap.', '15.50', 'TRUE', 'FALSE'],
      ['Healthy Wraps', 'Curried Egg Salad Wrap', 'Hard-boiled free-range eggs in a creamy mild curry mayonnaise, celery, chives, and butter lettuce in a whole wheat wrap.', '13.90', 'TRUE', 'FALSE'],
      ['Healthy Wraps', 'Pesto Quinoa Wrap', 'Cooked tri-color quinoa, basil pesto, roasted cherry tomatoes, baby mozzarella balls, and rocket in a soft wrap.', '14.90', 'TRUE', 'FALSE']
    ];

    // Artisan Burgers (15 items)
    const burgers = [
      ['Artisan Burgers', 'The Cafe Express Signature', '200g premium Angus beef patty, melted American cheddar, butter lettuce, sliced tomato, pickles, and our secret burger sauce on a toasted brioche bun.', '18.90', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Truffle & Forest Mushroom', '200g Angus beef patty, Swiss cheese, wild mushrooms sautéed in white wine and garlic, truffle mayonnaise, and baby rocket on brioche.', '21.50', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Spicy Crispy Chicken', 'Buttermilk-fried chicken thigh, spicy sriracha slaw, pickles, jalapenos, and chipotle mayo on a toasted bun.', '19.50', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'The Bacon & Blue', 'Angus beef patty, crispy maple bacon, crumbled blue cheese, caramelized onion jam, and baby spinach on brioche.', '20.90', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Smoked Hickory BBQ', 'Angus beef patty, double cheddar, crispy onion rings, maple bacon, and smoky hickory barbecue sauce on a brioche bun.', '19.90', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'The Garden Plant-Based', 'Premium plant-based v2 patty, vegan cheddar, butter lettuce, tomato, pickles, mustard, and vegan mayo on a potato bun.', '18.90', 'TRUE', 'FALSE'],
      ['Artisan Burgers', 'Grilled Haloumi Burger', 'Thick slab of grilled Cyprus haloumi, roasted red pepper, butter lettuce, tomato, and basil pesto mayo on a toasted bun.', '17.90', 'TRUE', 'FALSE'],
      ['Artisan Burgers', 'Aussie Outback Burger', 'Angus beef patty, fried egg, crispy bacon, slice of beetroot, pineapple, cheddar, lettuce, tomato, and barbecue sauce on brioche.', '21.00', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Korean Fried Chicken Burger', 'Crispy chicken glazed in sweet sticky Gochujang sauce, kimchi slaw, sesame seeds, and kewpie mayo on a brioche bun.', '19.90', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Pulled Beef Brisket Burger', '12-hour slow-cooked beef brisket, smoky barbecue sauce, apple cider slaw, and pickles on a toasted brioche bun.', '20.50', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Greek Spiced Lamb Burger', 'Char-grilled herb-spiced lamb patty, cucumber ribbon, tomato, red onion, crumbled feta, and fresh tzatziki sauce on flatbread bun.', '20.00', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Soft Shell Crab Burger', 'Crispy tempura soft shell crab, mango-chili salsa, shredded lettuce, and coriander-lime mayo on a charcoal bun.', '23.50', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Chipotle Black Bean Burger', 'House-made spicy black bean and corn patty, avocado mash, tomato salsa, and chipotle mayo on a whole wheat bun.', '17.50', 'TRUE', 'FALSE'],
      ['Artisan Burgers', 'The Hawaiian Teriyaki', 'Angus beef patty, grilled pineapple slice, Swiss cheese, teriyaki glaze, butter lettuce, and sweet mayo on brioche.', '18.90', 'FALSE', 'FALSE'],
      ['Artisan Burgers', 'Gluten-Free Deluxe Burger', 'Angus beef patty, cheddar, lettuce, tomato, pickles, and ketchup served on a toasted premium gluten-free bun.', '19.90', 'FALSE', 'TRUE']
    ];

    // Fresh Juices (15 items)
    const juices = [
      ['Fresh Juices', 'The Green Detoxifier', 'Cold-pressed green apple, celery, cucumber, baby spinach, kale, ginger, and a splash of fresh lemon juice.', '9.50', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Tropical Citrus Breeze', 'Freshly squeezed orange, pineapple, passionfruit pulp, and a hint of fresh mint.', '8.90', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Ruby Beetroot Blast', 'Cold-pressed beetroot, sweet carrots, red apples, ginger root, and fresh lime juice.', '9.00', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Watermelon Hydrator', 'Pure cold-pressed watermelon, fresh mint leaves, coconut water, and lime.', '8.50', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Immunity Booster', 'Orange, carrot, fresh turmeric root, ginger, and a pinch of black pepper for absorption.', '9.20', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Sweet Apple Zing', 'Crisp red apple, sweet pear, and fresh ginger juice cold-pressed over ice.', '8.50', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Berry Antiox', 'Blended strawberries, blueberries, raspberries, apple juice, and organic honey.', '9.50', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Pineapple Ginger Zest', 'Pineapple, golden apple, fresh ginger root, and mint.', '8.90', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Pure Squeezed Valencia Orange', '100% premium Valencia oranges squeezed fresh daily with no added sugar or preservatives.', '7.90', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Celery Cleanse', '100% cold-pressed organic celery juice with a touch of fresh lemon.', '8.90', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Mango Passion Cooler', 'Mango nectar, fresh orange juice, passionfruit, and crushed ice.', '9.50', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Spiced Carrot & Pear', 'Carrot, pear, red apple, and a pinch of ground cinnamon.', '8.90', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Cucumber Mint Hydration', 'Cold-pressed cucumber, green apple, fresh mint, and lime.', '8.50', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Pomegranate Ruby Shield', 'Cold-pressed pomegranate seeds, red apple, and blueberries.', '9.90', 'TRUE', 'TRUE'],
      ['Fresh Juices', 'Ginger Lemon Tonic Shot', 'Concentrated shot of ginger root and fresh lemon juice with a drop of honey (served in a 60ml glass).', '5.00', 'TRUE', 'TRUE']
    ];

    // Specialty Coffee & Tea (16 items to reach a total of 107 items)
    const coffee = [
      ['Specialty Coffee & Tea', 'Single Origin Espresso', 'Double shot of our rotating single origin espresso, featuring complex notes of stone fruit and brown sugar.', '4.50', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Classic Flat White', 'Double shot of house espresso blend with velvety micro-foamed milk.', '4.80', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Caffe Latte', 'Espresso with steamed milk and a thin layer of foam, served in a glass.', '4.80', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Cappuccino', 'Classic espresso topped with equal parts steamed milk and thick foam, dusted with premium Belgian cocoa.', '4.80', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Piccolo Latte', 'A single ristretto shot topped with warm micro-foamed milk in a 90ml glass.', '4.20', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Long Black', 'Double shot of espresso extracted over hot water, preserving the golden crema.', '4.50', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Traditional Macchiato', 'Double shot of espresso marked with a dollop of warm milk foam.', '4.30', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Pour Over V60 Filter', 'Hand-brewed single origin coffee utilizing the V60 method, highlighting delicate floral and tea-like notes.', '6.50', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Cold Drip Coffee', 'Water dripped slowly through ground coffee over 10 hours, served over a large block of ice.', '6.00', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Spanish Cortado', 'Equal parts double espresso and warm steamed milk, served in a small tumbler.', '4.50', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Dirty Chai Latte', 'Traditional spiced black tea chai latte infused with a double shot of espresso.', '5.50', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Organic Matcha Latte', 'Ceremonial grade organic Japanese matcha whisked with hot water and topped with steamed oat milk.', '5.90', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Golden Turmeric Latte', 'Spiced turmeric, ginger, cinnamon, and black pepper blend steamed with soy milk and honey.', '5.50', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Loose Leaf English Breakfast', 'Premium full-bodied organic black tea leaves, brewed at 95 degrees, served with milk.', '5.00', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Sencha Green Tea', 'High-grade Japanese green tea leaves yielding a sweet, grassy, and savory cup.', '5.00', 'TRUE', 'TRUE'],
      ['Specialty Coffee & Tea', 'Peppermint & Chamomile Herbal', 'A soothing blend of dried organic peppermint leaves and Egyptian chamomile flowers.', '5.00', 'TRUE', 'TRUE']
    ];

    // Artisanal Sweet Treats (15 items)
    const sweets = [
      ['Artisanal Sweet Treats', 'Lemon Meringue Tart', 'Classic crisp sweet pastry shell filled with tangy lemon curd, topped with high peaks of toasted Italian meringue.', '8.50', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Salted Caramel Macadamia Brownie', 'Rich Belgian chocolate brownie swirled with sea salt caramel and toasted local macadamia nuts.', '7.90', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Gluten-Free Almond Friand', 'Moist traditional French almond cake baked with fresh seasonal raspberries, dusted with icing sugar.', '6.50', 'TRUE', 'TRUE'],
      ['Artisanal Sweet Treats', 'Warm Cinnamon Escargot', 'Buttery layered Danish pastry rolled with sweet cinnamon butter, topped with vanilla sugar glaze.', '6.80', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Carrot & Walnut Cake', 'Spiced carrot cake layers with walnuts, raisins, covered in smooth cream cheese frosting.', '8.00', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Triple Chocolate Cookie', 'Jumbo house-baked cookie loaded with dark, milk, and white chocolate chunks, served warm.', '5.00', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Traditional Scones', 'Two warm house-baked scones served with rich clotted cream and homemade strawberry jam.', '9.50', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Portuguese Custard Tart', 'Traditional Pastel de Nata featuring crisp puff pastry filled with warm caramelized custard.', '5.50', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Banana Bread Slice', 'Toasted thick slice of house banana bread, served with whipped maple butter.', '6.90', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Pistachio Baklava', 'Layers of crispy phyllo pastry filled with chopped pistachios, sweetened with spiced honey syrup.', '6.00', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Vegan Chia Seed Pudding', 'Coconut milk chia seed pudding layered with fresh mango puree and toasted coconut flakes.', '7.50', 'TRUE', 'TRUE'],
      ['Artisanal Sweet Treats', 'Apple Cinnamon Muffin', 'Fluffy muffin baked with fresh granny smith apple chunks, topped with brown sugar oat crumble.', '5.90', 'TRUE', 'FALSE'],
      ['Artisanal Sweet Treats', 'Raw Matcha Lime Slice', 'Nutty base of almonds and dates, topped with creamy raw cashew, lime juice, and matcha filling.', '7.90', 'TRUE', 'TRUE'],
      ['Artisanal Sweet Treats', 'Double Chocolate Gluten-Free Muffin', 'Deep cocoa gluten-free muffin baked with dark chocolate chips and a melted fudge center.', '6.50', 'TRUE', 'TRUE'],
      ['Artisanal Sweet Treats', 'Red Velvet Cupcake', 'Soft red velvet cupcake topped with vanilla cream cheese frosting and a sprinkle of cake crumbs.', '5.50', 'TRUE', 'FALSE']
    ];

    // Combine all arrays
    const allRows = [
      ...breakfast,
      ...paninis,
      ...wraps,
      ...burgers,
      ...juices,
      ...coffee,
      ...sweets
    ];

    // Convert to CSV lines
    allRows.forEach(row => {
      // Escape columns containing commas in quotes
      const escapedRow = row.map(col => {
        if (col.includes(',') || col.includes('"')) {
          // Double quotes escape and wrap in quotes
          return `"${col.replace(/"/g, '""')}"`;
        }
        return col;
      });
      rows.push(escapedRow.join(','));
    });

    return header + rows.join('\n');
  }
}
