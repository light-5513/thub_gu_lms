def ip_address(x):
    base_ip = "10.1.0.0"
    ip_parts = list(map(int, base_ip.split('.')))
    
    if x < 0 or x >= 2**32:
        return "Invalid input"
    
    for i in range(3, -1, -1):
        #print(i)
        ip_parts[i] += x % 256
        x //= 256
        
    return ".".join(map(str,ip_parts))

x = 1024
print("The ",x,"\rth IP Adress is : ",ip_address(x-1),sep="")